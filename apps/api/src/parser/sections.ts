import { sectionKindOf, type SectionKind } from "./dictionaries/section-headers";
import { isAllCaps, isBlank, normalise, wordsOf } from "./text";

export interface Section {
  kind: SectionKind;
  heading: string | null;
  lines: string[];
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

const trimmed = (lines: readonly string[]): string[] => {
  const start = lines.findIndex((line) => !isBlank(line));

  if (start === -1) {
    return [];
  }

  const end = lines.length - [...lines].reverse().findIndex((line) => !isBlank(line));

  return lines.slice(start, end);
};

// Cuts the cleaned lines at every heading; what comes before the first heading is the header.
export function splitSections(lines: readonly string[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { kind: "header", heading: null, lines: [] };

  lines.forEach((line, index) => {
    const kind = isHeader(line, lines[index + 1]);

    if (kind) {
      sections.push(current);
      current = { kind, heading: line.trim(), lines: [] };

      return;
    }

    current.lines.push(line);
  });

  sections.push(current);

  return sections
    .map((section) => ({ ...section, lines: trimmed(section.lines) }))
    .filter((section) => section.heading !== null || section.lines.length > 0);
}
