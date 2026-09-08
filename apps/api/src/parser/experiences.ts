import type { DraftExperience, Field } from "@helpmegethired/shared";

import { findDateRange, withoutDateRange, type DateRangeMatch } from "./dates";
import { hasJobTitleWord } from "./dictionaries/job-titles";
import { hasLetters, isBlank, trimTrailing, wordsOf } from "./text";

const HEADING_MAX_WORDS = 12;
const HEADING_MAX_LINES = 2;
const HEADING_MAX_PARTS = 3;
const SENTENCE_END = /[!?]$|\.$/u;
const ABBREVIATION_MAX_LETTERS = 4;
const PART_SEPARATOR = /\s*\|\s*|\s+[-–—]\s+|\s*,\s*|\s+(?:em|at|@|na|no)\s+|\s+·\s+/iu;
const TRAILING_SEPARATORS = " \t|,·-–—";

interface DatedLine {
  index: number;
  match: DateRangeMatch;
}

interface RawEntry {
  headingLines: string[];
  match: DateRangeMatch | null;
  descriptionLines: string[];
}

const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

// A final period ends a sentence unless it closes a short capitalised abbreviation such as
// "Ltd." or "S.A.", which a company name often carries.
const isAbbreviation = (word: string): boolean =>
  word.endsWith(".") && /^\p{Lu}/u.test(word) && word.replace(/\./gu, "").length <= ABBREVIATION_MAX_LETTERS;

const endsAsSentence = (line: string): boolean => {
  const last = wordsOf(line).at(-1) ?? "";

  return SENTENCE_END.test(last) && !isAbbreviation(last);
};

// A heading line is short and not a sentence, which tells "Backend Engineer | Acme" from a
// bullet of the previous entry's description.
const isHeadingLine = (line: string): boolean =>
  !isBlank(line) && wordsOf(line).length <= HEADING_MAX_WORDS && !endsAsSentence(line.trim());

// A short line naming a role and a company after a sentence opens an entry even when no
// blank line and no date line does, as a volunteer position listed without dates.
const isTitledHeading = (line: string): boolean => isHeadingLine(line) && hasJobTitleWord(line) && PART_SEPARATOR.test(line);

const opensEntry = (line: string, previous: string | undefined): boolean =>
  previous !== undefined && !isHeadingLine(previous) && isTitledHeading(line);

function blocksOf(lines: readonly string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  let previous: string | undefined;

  const close = () => {
    if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  };

  for (const line of lines) {
    if (isBlank(line)) {
      close();
    } else {
      if (opensEntry(line, previous)) {
        close();
      }

      current.push(line);
    }

    previous = isBlank(line) ? undefined : line;
  }

  close();

  return blocks;
}

// The heading of a dated entry is the one or two short lines right before its date line,
// never reaching back past the previous entry's date line.
function headingStartOf(block: readonly string[], dateIndex: number, previousDateIndex: number): number {
  let start = dateIndex;

  while (start - 1 > previousDateIndex && dateIndex - start < HEADING_MAX_LINES && isHeadingLine(block[start - 1] ?? "")) {
    start -= 1;
  }

  return start;
}

// When nothing precedes the date line, the heading is the rest of that line, as a resume
// that puts the dates first lays it out.
function headingOnDateLine(line: string, match: DateRangeMatch): string[] {
  const rest = trimTrailing(withoutDateRange(line, match), TRAILING_SEPARATORS);

  return hasLetters(rest) ? [rest] : [];
}

// A line with a date range starts an entry; the block is cut where each entry's heading
// starts, and what follows a date line up to the next cut is the description.
function datedEntries(block: readonly string[], dated: readonly DatedLine[]): RawEntry[] {
  const starts = dated.map((current, position) => headingStartOf(block, current.index, dated[position - 1]?.index ?? -1));

  return dated.map((current, position) => {
    const headingLines = block.slice(starts[position], current.index);

    return {
      headingLines: headingLines.length > 0 ? headingLines : headingOnDateLine(block[current.index] ?? "", current.match),
      match: current.match,
      descriptionLines: block.slice(current.index + 1, starts[position + 1] ?? block.length),
    };
  });
}

function rawEntriesOf(block: readonly string[]): RawEntry[] {
  const dated = block.flatMap((line, index) => {
    const match = findDateRange(line);

    return match ? [{ index, match }] : [];
  });

  if (dated.length === 0) {
    const [first, ...rest] = block;

    return first ? [{ headingLines: [first], match: null, descriptionLines: rest }] : [];
  }

  return datedEntries(block, dated);
}

const partsOf = (headingLines: readonly string[]): string[] =>
  (headingLines.length > 1 ? headingLines : (headingLines[0] ?? "").split(PART_SEPARATOR))
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, HEADING_MAX_PARTS);

// The dictionary decides which part is the role when exactly one part carries a title word;
// otherwise both parts are kept as they are, with low confidence, for the Candidate to fix.
function roleAndCompany(headingLines: readonly string[]): Pick<DraftExperience, "role" | "company"> {
  const parts = partsOf(headingLines);
  const titled = parts.filter(hasJobTitleWord);

  if (titled.length === 1) {
    const role = titled[0]!;
    const company = parts.find((part) => part !== role);

    return { role: field(role, "high"), company: company ? field(company, "high") : null };
  }

  const [role = "", company] = parts;

  return { role: field(role, "low"), company: company ? field(company, "low") : null };
}

function toExperience(entry: RawEntry): DraftExperience | undefined {
  if (entry.headingLines.length === 0) {
    return undefined;
  }

  const description = entry.descriptionLines.map((line) => line.trim()).filter((line) => line.length > 0).join("\n");

  return {
    ...roleAndCompany(entry.headingLines),
    period: entry.match ? field(entry.match.period, "high") : null,
    description: description ? field(description, "high") : null,
    skills: [],
  };
}

export function extractExperiences(lines: readonly string[]): DraftExperience[] {
  return blocksOf(lines)
    .flatMap(rawEntriesOf)
    .flatMap((entry) => {
      const experience = toExperience(entry);

      return experience ? [experience] : [];
    });
}
