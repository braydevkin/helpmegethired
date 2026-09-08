import type { Confidence, ProfilePart, ReviewFlag } from "@helpmegethired/shared";

import type { Segment } from "../ingestion/segment";
import { RecognizedByKindSchema } from "./segments/recognized";
import { RESUME_SEGMENT_KINDS, type ResumeSegmentKind } from "./segments/resume-segments";

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

const isResumeKind = (kind: string): kind is ResumeSegmentKind => (RESUME_SEGMENT_KINDS as readonly string[]).includes(kind);

const lowSkills = (recognized: unknown): ReviewFlag[] =>
  RecognizedByKindSchema.skills
    .parse(recognized)
    .skills.flatMap((skill) => (skill.confidence === REVIEW_BAR ? [{ part: "skill" as const, entry: skill.name, field: "name", reason: "low_confidence" as const }] : []));

const headerFlags = (recognized: unknown): ReviewFlag[] => {
  const header = RecognizedByKindSchema.header.parse(recognized);
  const mismatches: ReviewFlag[] = (["name", "email"] as const)
    .filter((field) => header.accountMismatch[field])
    .map((field) => ({ part: "basicProfile", entry: null, field, reason: "account_mismatch" }));

  return [...flagsOfEntry("basicProfile", header.basicProfile, null), ...mismatches];
};

const flagsByKind: Record<ResumeSegmentKind, (recognized: unknown) => ReviewFlag[]> = {
  header: headerFlags,
  experience: (recognized) =>
    RecognizedByKindSchema.experience.parse(recognized).experiences.flatMap((entry) => flagsOfEntry("experience", entry, entry.role.value)),
  education: (recognized) =>
    RecognizedByKindSchema.education.parse(recognized).education.flatMap((entry) => flagsOfEntry("education", entry, entry.institution.value)),
  project: (recognized) => RecognizedByKindSchema.project.parse(recognized).projects.flatMap((entry) => flagsOfEntry("project", entry, entry.name.value)),
  skills: lowSkills,
  languages: (recognized) =>
    RecognizedByKindSchema.languages.parse(recognized).languages.flatMap((entry) => flagsOfEntry("language", entry, entry.name.value)),
  certifications: (recognized) =>
    RecognizedByKindSchema.certifications
      .parse(recognized)
      .certifications.flatMap((entry) => flagsOfEntry("certification", entry, entry.name.value)),
};

// Only a saved Segment of a resume kind whose output still reads as expected contributes.
function flagsOfSegment(segment: Segment): ReviewFlag[] {
  if (!isResumeKind(segment.kind) || segment.status !== "saved") {
    return [];
  }

  return RecognizedByKindSchema[segment.kind].safeParse(segment.recognized).success ? flagsByKind[segment.kind](segment.recognized) : [];
}

// The fields the Candidate should look at, read from the Segments' recognized output: the
// ones recognised at the review bar, and the header's name or e-mail when they differ from
// the Account.
export const reviewFlagsOf = (segments: readonly Segment[]): ReviewFlag[] => segments.flatMap(flagsOfSegment);
