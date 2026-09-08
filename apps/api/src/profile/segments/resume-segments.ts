import type { Id } from "@helpmegethired/shared";

import type { NewSegment } from "../../ingestion/segment";
import {
  blockRangesOf,
  cleanText,
  opensExperience,
  opensProject,
  partitionLabelled,
  splitSections,
  type LineRange,
  type Section,
  type SectionKind,
} from "../../parser";

export const RESUME_SEGMENT_KINDS = ["header", "experience", "education", "project", "skills", "languages", "certifications"] as const;

export type ResumeSegmentKind = (typeof RESUME_SEGMENT_KINDS)[number];

// A Segment names the Uploaded Resume it reads and the slices of its cleaned text it covers:
// `ranges` line by line, `paragraphs` joined into one line each, as a labelled paragraph
// found in another section is read.
export interface ResumeSegmentInput {
  uploadedResumeId: Id;
  ranges: LineRange[];
  paragraphs: LineRange[];
}

export interface ResumeSegment extends NewSegment {
  kind: ResumeSegmentKind;
  input: ResumeSegmentInput;
}

const TOP_KINDS = new Set<SectionKind>(["header", "contact", "summary"]);

export const cleanedLinesOf = (text: string): string[] => cleanText(text).split("\n");

const shifted = (range: LineRange, offset: number): LineRange => ({ start: range.start + offset, end: range.end + offset });

// Labelled paragraphs of another kind, as ranges over the whole text, grouped by that kind.
function labelledParagraphsOf(sections: readonly Section[]): Map<SectionKind, LineRange[]> {
  const byKind = new Map<SectionKind, LineRange[]>();

  for (const section of sections) {
    for (const paragraph of partitionLabelled(section.lines, section.kind).labelled) {
      byKind.set(paragraph.kind, [...(byKind.get(paragraph.kind) ?? []), shifted(paragraph.range, section.linesRange.start)]);
    }
  }

  return byKind;
}

const hasOwnLines = (lines: readonly string[], kind: SectionKind): boolean =>
  partitionLabelled(lines, kind).own.some((line) => line.trim().length > 0);

// A block that is only a labelled paragraph of another kind is that kind's, not an entry.
const blocksOfSections = (sections: readonly Section[], opens: Parameters<typeof blockRangesOf>[1]): LineRange[] =>
  sections.flatMap((section) =>
    blockRangesOf(section.lines, opens)
      .filter((block) => hasOwnLines(section.lines.slice(block.start, block.end), section.kind))
      .map((block) => shifted(block, section.linesRange.start)),
  );

// The sections decide the Segments, in the order the Profile parts are built: the header
// (with the contact block and the summaries), one Experience per block, the education, one
// Project per block, the skills over the whole text, the languages, the certifications. A
// part the resume lacks produces no Segment.
export function resumeSegmentsOf(text: string, uploadedResumeId: Id): ResumeSegment[] {
  const lines = cleanedLinesOf(text);
  const sections = splitSections(lines);
  const paragraphs = labelledParagraphsOf(sections);
  const ofKind = (kind: SectionKind) => sections.filter((section) => section.kind === kind);
  const segment = (kind: ResumeSegmentKind, ranges: LineRange[], extra: LineRange[] = []): ResumeSegment[] =>
    ranges.length + extra.length > 0 ? [{ kind, input: { uploadedResumeId, ranges, paragraphs: extra } }] : [];
  const segmentPerBlock = (kind: ResumeSegmentKind, blocks: LineRange[]): ResumeSegment[] =>
    blocks.flatMap((block) => segment(kind, [block]));
  const segmentOfSections = (kind: ResumeSegmentKind, sectionKind: SectionKind): ResumeSegment[] =>
    segment(kind, ofKind(sectionKind).map((section) => section.linesRange), paragraphs.get(sectionKind));

  return [
    ...segment("header", sections.filter((section) => TOP_KINDS.has(section.kind)).map((section) => section.range)),
    ...segmentPerBlock("experience", blocksOfSections(ofKind("experience"), opensExperience)),
    ...segmentOfSections("education", "education"),
    ...segmentPerBlock("project", blocksOfSections(ofKind("projects"), opensProject)),
    ...(lines.some((line) => line.trim().length > 0) ? segment("skills", [{ start: 0, end: lines.length }]) : []),
    ...segmentOfSections("languages", "languages"),
    ...segmentOfSections("certifications", "certifications"),
  ];
}
