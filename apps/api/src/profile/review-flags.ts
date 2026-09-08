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

function flagsOfSegment(segment: Segment): ReviewFlag[] {
  if (!isResumeKind(segment.kind) || segment.status !== "saved") {
    return [];
  }

  const parsed = RecognizedByKindSchema[segment.kind].safeParse(segment.recognized);

  if (!parsed.success) {
    return [];
  }

  switch (segment.kind) {
    case "header": {
      const header = RecognizedByKindSchema.header.parse(segment.recognized);
      const mismatches: ReviewFlag[] = (["name", "email"] as const)
        .filter((field) => header.accountMismatch[field])
        .map((field) => ({ part: "basicProfile", entry: null, field, reason: "account_mismatch" }));

      return [...flagsOfEntry("basicProfile", header.basicProfile, null), ...mismatches];
    }
    case "experience":
      return RecognizedByKindSchema.experience.parse(segment.recognized).experiences.flatMap((entry) => flagsOfEntry("experience", entry, entry.role.value));
    case "education":
      return RecognizedByKindSchema.education
        .parse(segment.recognized)
        .education.flatMap((entry) => flagsOfEntry("education", entry, entry.institution.value));
    case "project":
      return RecognizedByKindSchema.project.parse(segment.recognized).projects.flatMap((entry) => flagsOfEntry("project", entry, entry.name.value));
    case "skills":
      return RecognizedByKindSchema.skills
        .parse(segment.recognized)
        .skills.flatMap((skill) => (skill.confidence === REVIEW_BAR ? [{ part: "skill" as const, entry: skill.name, field: "name", reason: "low_confidence" as const }] : []));
    case "languages":
      return RecognizedByKindSchema.languages.parse(segment.recognized).languages.flatMap((entry) => flagsOfEntry("language", entry, entry.name.value));
    case "certifications":
      return RecognizedByKindSchema.certifications
        .parse(segment.recognized)
        .certifications.flatMap((entry) => flagsOfEntry("certification", entry, entry.name.value));
  }
}

// The fields the Candidate should look at, read from the Segments' recognized output: the
// ones recognised at the review bar, and the header's name or e-mail when they differ from
// the Account.
export const reviewFlagsOf = (segments: readonly Segment[]): ReviewFlag[] => segments.flatMap(flagsOfSegment);
