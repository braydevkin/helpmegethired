import type { Id } from "@helpmegethired/shared";

import type { NewSegment } from "../../ingestion/segment";
import { cleanText, type LineRange } from "../../parser";

export const RESUME_SEGMENT_KINDS = ["header", "experience", "education", "project", "skills", "languages", "certifications"] as const;

export type ResumeSegmentKind = (typeof RESUME_SEGMENT_KINDS)[number];

// A Segment names the Uploaded Resume it reads and the line ranges of its cleaned text it covers.
export interface ResumeSegmentInput {
  uploadedResumeId: Id;
  ranges: LineRange[];
}

export interface ResumeSegment extends NewSegment {
  kind: ResumeSegmentKind;
  input: ResumeSegmentInput;
}

export const cleanedLinesOf = (text: string): string[] => cleanText(text).split("\n");

// One Segment per Profile part, in the order the parts are built, each over the whole text: the
// headings a resume uses are not where its entries begin and end, so every part is looked for
// everywhere, and a job under a misleading sub-heading is still read as a job.
export function resumeSegmentsOf(text: string, uploadedResumeId: Id): ResumeSegment[] {
  const lines = cleanedLinesOf(text);

  if (lines.every((line) => line.trim().length === 0)) {
    return [];
  }

  const wholeText: LineRange[] = [{ start: 0, end: lines.length }];

  return RESUME_SEGMENT_KINDS.map((kind) => ({ kind, input: { uploadedResumeId, ranges: wholeText } }));
}
