import type { DraftEducation, Field } from "@helpmegethired/shared";

import { hasDegreeTerm } from "./dictionaries/degrees";
import { isHeadingLine, splitEntries, type RawEntry } from "./entries";
import { normalise, wordsOf } from "./text";

const PART_SEPARATOR = /\s*\|\s*|\s+[-–—]\s+|\s*,\s*|\s+(?:em|in|at|@|na|no)\s+|\s*·\s*/iu;
const FIELD_CONNECTOR = /\s+(?:em|in)\s+/iu;
const INSTITUTION_WORDS = [
  "universidade",
  "university",
  "universitat",
  "universite",
  "faculdade",
  "faculty",
  "instituto",
  "institute",
  "college",
  "school",
  "escola",
  "centro",
  "politecnico",
  "polytechnic",
  "academia",
  "academy",
  "unicamp",
  "unesp",
  "fatec",
  "senac",
  "senai",
];
const institutionWords = new Set(INSTITUTION_WORDS);
const ACRONYM = /^\p{Lu}{2,7}$/u;

const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

const startsLowercase = (line: string): boolean => /^\p{Ll}/u.test(line.trim());

// An institution names itself with a known word or with an acronym such as "UFSC" or "IFPE".
const readsAsInstitution = (part: string): boolean =>
  wordsOf(part).some((word) => institutionWords.has(normalise(word)) || ACRONYM.test(word));

// An education heading wraps rather than describes: a following line that starts lowercase,
// and every short line after the date line, continues the heading text.
function headingTextOf(entry: RawEntry): string[] {
  const lines: string[] = [];

  for (const line of [...entry.headingLines, ...(entry.dateLineRest ? [entry.dateLineRest] : [])]) {
    if (lines.length > 0 && startsLowercase(line)) {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${line.trim()}`;
    } else {
      lines.push(line.trim());
    }
  }

  for (const line of entry.descriptionLines) {
    if (lines.length > 0 && isHeadingLine(line)) {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${line.trim()}`;
    }
  }

  return lines;
}

const partsOf = (headingLines: readonly string[]): string[] =>
  headingLines.flatMap((line) => line.split(PART_SEPARATOR)).map((part) => part.trim()).filter((part) => part.length > 0);

interface DegreeAndField {
  degree: string;
  fieldOfStudy: string | undefined;
}

// "MSc in Computer Science" and "Bacharelado em Matemática" carry the field after the
// connector; "MSc" alone leaves it to the next part.
function degreeAndFieldOf(part: string): DegreeAndField {
  const connector = FIELD_CONNECTOR.exec(part);

  if (!connector) {
    return { degree: part, fieldOfStudy: undefined };
  }

  return { degree: part.slice(0, connector.index).trim(), fieldOfStudy: part.slice(connector.index + connector[0].length).trim() };
}

function withDegree(parts: readonly string[], degreeIndex: number, heading: string): Omit<DraftEducation, "period"> {
  const { degree, fieldOfStudy } = degreeAndFieldOf(parts[degreeIndex] ?? "");
  const next = parts[degreeIndex + 1];
  const fieldFromNext = fieldOfStudy === undefined && next !== undefined && !readsAsInstitution(next) && !hasDegreeTerm(next);
  const studied = fieldOfStudy ?? (fieldFromNext ? next : undefined);
  const rest = parts.filter((part, index) => index !== degreeIndex && !(fieldFromNext && index === degreeIndex + 1));
  const institution = rest.find(readsAsInstitution) ?? rest[0];

  return {
    institution: institution ? field(institution, "high") : field(heading, "low"),
    degree: field(degree, "high"),
    fieldOfStudy: studied ? field(studied, "high") : null,
  };
}

// Without a degree word the first part is the institution and the second the degree, both
// low, for the Candidate to fix.
function withoutDegree(parts: readonly string[]): Omit<DraftEducation, "period"> {
  const institutionIndex = Math.max(parts.findIndex(readsAsInstitution), 0);
  const institution = parts[institutionIndex] ?? "";
  const degree = parts.find((part, index) => index !== institutionIndex);

  return {
    institution: field(institution, "low"),
    degree: degree ? field(degree, "low") : null,
    fieldOfStudy: null,
  };
}

function toEducation(entry: RawEntry): DraftEducation | undefined {
  const heading = headingTextOf(entry);
  const parts = partsOf(heading);

  if (parts.length === 0) {
    return undefined;
  }

  const degreeIndex = parts.findIndex(hasDegreeTerm);

  return {
    ...(degreeIndex === -1 ? withoutDegree(parts) : withDegree(parts, degreeIndex, heading.join(", "))),
    period: entry.match ? field(entry.match.period, "high") : null,
  };
}

export function extractEducation(lines: readonly string[]): DraftEducation[] {
  return splitEntries(lines).flatMap((entry) => {
    const education = toEducation(entry);

    return education ? [education] : [];
  });
}
