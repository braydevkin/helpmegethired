import { sectionKindOf, type SectionKind } from "./dictionaries/section-headers";
import { isAllCaps, isBlank, normalise, wordsOf, type LineRange } from "./text";

// What the layers that walk sections need of one: its kind and its lines.
export type SectionLines = Pick<Section, "kind" | "lines">;

// The range covers the heading line and the section's lines as [start, end) over the input;
// linesRange covers the lines alone, so a slice of the input gives the same text back.
export interface Section {
  kind: SectionKind;
  heading: string | null;
  lines: string[];
  range: LineRange;
  linesRange: LineRange;
}

export interface HeaderScore {
  kind: SectionKind | undefined;
  score: number;
}

// A heading is a dictionary line (2 points) with at least one more sign of a heading: all
// caps, short, or followed by a blank line (1 point each). A dictionary word inside a
// sentence never reaches the threshold.
export const HEADER_THRESHOLD = 3;
const DICTIONARY_POINTS = 2;
const SHORT_LINE_MAX_WORDS = 4;
const SHORT_LINE_MAX_CHARACTERS = 40;

const isShort = (line: string): boolean =>
  wordsOf(line).length <= SHORT_LINE_MAX_WORDS && line.trim().length <= SHORT_LINE_MAX_CHARACTERS;

export function scoreHeader(line: string, nextLine: string | undefined): HeaderScore {
  const kind = sectionKindOf(normalise(line));
  const score =
    (kind ? DICTIONARY_POINTS : 0) + (isAllCaps(line) ? 1 : 0) + (isShort(line) ? 1 : 0) + (isBlank(nextLine) ? 1 : 0);

  return { kind, score };
}

export const isHeader = (line: string, nextLine: string | undefined): SectionKind | undefined => {
  const { kind, score } = scoreHeader(line, nextLine);

  return kind !== undefined && score >= HEADER_THRESHOLD ? kind : undefined;
};

interface OpenSection {
  kind: SectionKind;
  heading: string | null;
  start: number;
  firstLine: number;
}

// The section's lines without the blank ones at either end, as a range over the input.
function trimmedRange(lines: readonly string[], start: number, end: number): LineRange {
  let first = start;
  let last = end;

  while (first < last && isBlank(lines[first])) {
    first += 1;
  }

  while (last > first && isBlank(lines[last - 1])) {
    last -= 1;
  }

  return { start: first, end: last };
}

const close = (open: OpenSection, end: number, lines: readonly string[]): Section => {
  const linesRange = trimmedRange(lines, open.firstLine, end);

  return {
    kind: open.kind,
    heading: open.heading,
    lines: lines.slice(linesRange.start, linesRange.end),
    range: { start: open.start, end },
    linesRange,
  };
};

// Cuts the cleaned lines at every heading; what comes before the first heading is the header.
export function splitSections(lines: readonly string[]): Section[] {
  const sections: Section[] = [];
  let open: OpenSection = { kind: "header", heading: null, start: 0, firstLine: 0 };

  lines.forEach((line, index) => {
    const kind = isHeader(line, lines[index + 1]);

    if (kind) {
      sections.push(close(open, index, lines));
      open = { kind, heading: line.trim(), start: index, firstLine: index + 1 };
    }
  });

  sections.push(close(open, lines.length, lines));

  return sections.filter((section) => section.heading !== null || section.lines.length > 0);
}
