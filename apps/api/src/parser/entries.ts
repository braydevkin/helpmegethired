import { findDateRange, withoutDateRange, type DateRangeMatch } from "./dates";
import { hasLetters, isBlank, trimTrailing, wordsOf, type LineRange } from "./text";

export interface RawEntry {
  headingLines: string[];
  dateLineRest: string | undefined;
  match: DateRangeMatch | null;
  descriptionLines: string[];
}

export type OpensEntry = (line: string, previous: string | undefined) => boolean;

const HEADING_MAX_WORDS = 12;
const HEADING_MAX_LINES = 2;
const SENTENCE_END = /[!?]$|\.$/u;
const COMPANY_ABBREVIATIONS = new Set(["ltd", "ltda", "inc", "co", "corp", "llc", "sa", "gmbh", "ag", "plc", "pty", "bv", "srl", "eireli", "mei", "jr", "sr"]);
const TRAILING_SEPARATORS = " \t|,·-–—:;()";

const never: OpensEntry = () => false;

interface DatedLine {
  index: number;
  match: DateRangeMatch;
}

// A final period ends a sentence unless it closes a company abbreviation such as "Ltd." or
// "S.A."; a bullet that ends in "Go." is still a sentence.
const isAbbreviation = (word: string): boolean => word.endsWith(".") && COMPANY_ABBREVIATIONS.has(word.replace(/\./gu, "").toLowerCase());

export const endsAsSentence = (line: string): boolean => {
  const last = wordsOf(line).at(-1) ?? "";

  return SENTENCE_END.test(last) && !isAbbreviation(last);
};

// A heading line is short and not a sentence, which tells "Backend Engineer | Acme" from a
// bullet of the previous entry's description.
export const isHeadingLine = (line: string): boolean =>
  !isBlank(line) && wordsOf(line).length <= HEADING_MAX_WORDS && !endsAsSentence(line.trim());

// Blocks are cut at blank lines and wherever the caller's rule says a line opens an entry
// even without a blank line before it; each block is a range [start, end) over the lines.
export function blockRangesOf(lines: readonly string[], opensEntry: OpensEntry = never): LineRange[] {
  const blocks: LineRange[] = [];
  let start: number | undefined;
  let previous: string | undefined;

  const close = (end: number) => {
    if (start !== undefined) {
      blocks.push({ start, end });
      start = undefined;
    }
  };

  lines.forEach((line, index) => {
    if (isBlank(line)) {
      close(index);
    } else {
      if (previous !== undefined && opensEntry(line, previous)) {
        close(index);
      }

      start ??= index;
    }

    previous = isBlank(line) ? undefined : line;
  });

  close(lines.length);

  return blocks;
}

export const blocksOf = (lines: readonly string[], opensEntry: OpensEntry = never): string[][] =>
  blockRangesOf(lines, opensEntry).map((block) => lines.slice(block.start, block.end));

// The heading of a dated entry is the one or two short lines right before its date line,
// never reaching back past the previous entry's date line.
function headingStartOf(block: readonly string[], dateIndex: number, previousDateIndex: number): number {
  let start = dateIndex;

  while (start - 1 > previousDateIndex && dateIndex - start < HEADING_MAX_LINES && isHeadingLine(block[start - 1] ?? "")) {
    start -= 1;
  }

  return start;
}

// What the date line says besides the dates, as a resume that puts the dates first lays it out.
export function restOfDateLine(line: string, match: DateRangeMatch): string | undefined {
  const rest = trimTrailing(withoutDateRange(line, match), TRAILING_SEPARATORS).trim();

  return hasLetters(rest) ? rest : undefined;
}

// A line with a date range starts an entry; the block is cut where each entry's heading
// starts, and what follows a date line up to the next cut is the description.
function datedEntries(block: readonly string[], dated: readonly DatedLine[]): RawEntry[] {
  const starts = dated.map((current, position) => headingStartOf(block, current.index, dated[position - 1]?.index ?? -1));

  return dated.map((current, position) => ({
    headingLines: block.slice(starts[position], current.index),
    dateLineRest: restOfDateLine(block[current.index] ?? "", current.match),
    match: current.match,
    descriptionLines: block.slice(current.index + 1, starts[position + 1] ?? block.length),
  }));
}

// An entry with no line before its date line takes its heading from the rest of that line,
// as a resume that puts the dates first lays it out.
export const headingOf = (entry: RawEntry): string[] =>
  entry.headingLines.length > 0 ? entry.headingLines : entry.dateLineRest ? [entry.dateLineRest] : [];

// A block without a date range is one entry: its first line is the heading, the rest the description.
export function rawEntriesOf(block: readonly string[]): RawEntry[] {
  const dated = block.flatMap((line, index) => {
    const match = findDateRange(line);

    return match ? [{ index, match }] : [];
  });

  if (dated.length === 0) {
    const [first, ...rest] = block;

    return first ? [{ headingLines: [first], dateLineRest: undefined, match: null, descriptionLines: rest }] : [];
  }

  return datedEntries(block, dated);
}

export const splitEntries = (lines: readonly string[], opensEntry: OpensEntry = never): RawEntry[] =>
  blocksOf(lines, opensEntry).flatMap(rawEntriesOf);

export const joinedDescription = (lines: readonly string[]): string =>
  lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
