import type { DraftCertification, Field } from "@helpmegethired/shared";

import { findDateRange, withoutDateRange } from "./dates";
import { hasLetters, wordsOf } from "./text";

const YEAR = /(?<!\d)(?:19|20)\d{2}(?!\d)/u;
const ENTRY_SEPARATOR = /\s*;\s*|\s+\|\s+|\s+·\s+/u;
const ISSUER_SEPARATOR = /\s+[-–—]\s+|\s*\|\s*|\s*·\s*|\s*\(|\s*,\s*|\s+(?:by|por|pela|pelo)\s+/iu;
const EDGE_DECORATION = /^[\s,;|·()[\]:-]+|[\s,;|·()[\]:-]+$/gu;
const SPACES = /\s+/gu;
const LINE_MAX_WORDS = 15;

const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

const medium = (value: string): Field<string> => field(value, "medium");

const tidy = (text: string): string => text.replace(EDGE_DECORATION, "").replace(SPACES, " ").trim();

interface YearAndRest {
  year: number | undefined;
  rest: string;
}

// The year is the start of a validity range when the line has one, else the first year on it.
function yearAndRestOf(line: string): YearAndRest {
  const range = findDateRange(line);

  if (range) {
    return { year: Number(range.period.start.slice(0, 4)), rest: withoutDateRange(line, range) };
  }

  const year = YEAR.exec(line);

  return year ? { year: Number(year[0]), rest: `${line.slice(0, year.index)} ${line.slice(year.index + year[0].length)}` } : { year: undefined, rest: line };
}

// "Name — Issuer, 2023", "Name (Issuer, 2021)", and "2022  Name, Issuer" all read as the name
// up to the first separator and the issuer after it.
function certificationOf(line: string): DraftCertification | undefined {
  if (wordsOf(line).length > LINE_MAX_WORDS) {
    return undefined;
  }

  const { year, rest } = yearAndRestOf(line);
  const text = tidy(rest);
  const separator = ISSUER_SEPARATOR.exec(text);
  const name = separator ? tidy(text.slice(0, separator.index)) : text;
  const issuer = separator ? tidy(text.slice(separator.index + separator[0].length)) : "";

  if (!hasLetters(name)) {
    return undefined;
  }

  return {
    name: medium(name),
    issuer: hasLetters(issuer) ? medium(issuer) : null,
    year: year === undefined ? null : field(year, "medium"),
  };
}

// Several certifications on one line are separated by semicolons, bars, or middle dots.
export function extractCertifications(lines: readonly string[]): DraftCertification[] {
  return lines
    .flatMap((line) => line.split(ENTRY_SEPARATOR))
    .map((line) => line.trim())
    .filter((line) => hasLetters(line))
    .flatMap((line) => {
      const certification = certificationOf(line);

      return certification ? [certification] : [];
    });
}
