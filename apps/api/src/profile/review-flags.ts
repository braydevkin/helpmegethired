import type { Confidence, ProfilePart, ReviewFlag } from "@helpmegethired/shared";

import type { ZodType } from "zod";

import type { Segment } from "../ingestion/segment";
import {
  RecognizedCertificationsSchema,
  RecognizedEducationSchema,
  RecognizedExperienceSchema,
  RecognizedHeaderSchema,
  RecognizedLanguagesSchema,
  RecognizedProjectSchema,
  RecognizedSkillsSchema,
} from "./segments/recognized";
import type { RecognizedHeader, RecognizedSkills } from "./segments/recognized";
import type { ResumeSegmentKind } from "./segments/resume-segments";

const REVIEW_BAR: Confidence = "low";

interface RecognisedField {
  confidence: Confidence;
}

type Recognised<Entry> = { [Field in keyof Entry]: Entry[Field] };

const isRecognisedField = (value: unknown): value is RecognisedField =>
  typeof value === "object" && value !== null && "confidence" in value;

// Every field of an entry whose Confidence sits at the review bar, named with the entry's label.
function flagsOfEntry<Entry extends object>(part: ProfilePart, entry: Recognised<Entry>, label: string | null): ReviewFlag[] {
  return Object.entries(entry).flatMap(([field, value]) =>
    isRecognisedField(value) && value.confidence === REVIEW_BAR ? [{ part, entry: label, field, reason: "low_confidence" as const }] : [],
  );
}

// Answers the flags of a recognized output, or nothing when it no longer reads as expected.
type FlagReader = (recognized: unknown) => ReviewFlag[] | undefined;

const reader =
  <Recognized>(schema: ZodType<Recognized>, flags: (recognized: Recognized) => ReviewFlag[]): FlagReader =>
  (recognized) => {
    const parsed = schema.safeParse(recognized);

    return parsed.success ? flags(parsed.data) : undefined;
  };

const headerFlags = (header: RecognizedHeader): ReviewFlag[] => {
  const mismatches: ReviewFlag[] = (["name", "email"] as const)
    .filter((field) => header.accountMismatch[field])
    .map((field) => ({ part: "basicProfile", entry: null, field, reason: "account_mismatch" }));

  return [...flagsOfEntry("basicProfile", header.basicProfile, null), ...mismatches];
};

const lowSkills = (recognized: RecognizedSkills): ReviewFlag[] =>
  recognized.skills.flatMap((skill) =>
    skill.confidence === REVIEW_BAR ? [{ part: "skill" as const, entry: skill.name, field: "name", reason: "low_confidence" as const }] : [],
  );

// One reader per resume kind: the schema its recognized output must still match, and the
// flags it yields.
const readers = new Map<ResumeSegmentKind, FlagReader>([
  ["header", reader(RecognizedHeaderSchema, headerFlags)],
  ["experience", reader(RecognizedExperienceSchema, ({ experiences }) => experiences.flatMap((entry) => flagsOfEntry("experience", entry, entry.role.value)))],
  ["education", reader(RecognizedEducationSchema, ({ education }) => education.flatMap((entry) => flagsOfEntry("education", entry, entry.institution.value)))],
  ["project", reader(RecognizedProjectSchema, ({ projects }) => projects.flatMap((entry) => flagsOfEntry("project", entry, entry.name.value)))],
  ["skills", reader(RecognizedSkillsSchema, lowSkills)],
  ["languages", reader(RecognizedLanguagesSchema, ({ languages }) => languages.flatMap((entry) => flagsOfEntry("language", entry, entry.name.value)))],
  [
    "certifications",
    reader(RecognizedCertificationsSchema, ({ certifications }) => certifications.flatMap((entry) => flagsOfEntry("certification", entry, entry.name.value))),
  ],
]);

// Only a saved Segment of a resume kind whose output still reads as expected contributes.
function flagsOfSegment(segment: Segment): ReviewFlag[] {
  const kindReader = readers.get(segment.kind as ResumeSegmentKind);

  return (kindReader && segment.status === "saved" ? kindReader(segment.recognized) : undefined) ?? [];
}

// The fields the Candidate should look at, read from the Segments' recognized output: the
// ones recognised at the review bar, and the header's name or e-mail when they differ from
// the Account.
export const reviewFlagsOf = (segments: readonly Segment[]): ReviewFlag[] => segments.flatMap(flagsOfSegment);
