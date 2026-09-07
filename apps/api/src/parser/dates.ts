import type { Period, YearMonth } from "@helpmegethired/shared";

import { normalise } from "./text";

export interface DateRangeMatch {
  period: Period;
  index: number;
  length: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, janeiro: 1,
  feb: 2, fev: 2, february: 2, fevereiro: 2,
  mar: 3, march: 3, marco: 3,
  apr: 4, abr: 4, april: 4, abril: 4,
  may: 5, mai: 5, maio: 5,
  jun: 6, june: 6, junho: 6,
  jul: 7, july: 7, julho: 7,
  aug: 8, ago: 8, august: 8, agosto: 8,
  sep: 9, sept: 9, set: 9, september: 9, setembro: 9,
  oct: 10, out: 10, october: 10, outubro: 10,
  nov: 11, november: 11, novembro: 11,
  dec: 12, dez: 12, december: 12, dezembro: 12,
};

// One literal, with the date alternative written out three times, because a pattern built
// from strings is what static analysis treats as tainted; the pieces are, in order, a month
// name or abbreviation with its year, MM/YYYY, and a year alone.
const RANGE =
  /(?<![\p{L}\d/])(?:(desde|since)\s+((?:(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)\p{L}*\.?(?:\s+(?:de|of))?\s+(?:19|20)\d{2}|(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2}))|((?:(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)\p{L}*\.?(?:\s+(?:de|of))?\s+(?:19|20)\d{2}|(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2}))\s*(?:-|–|—|a|até|ate|to)\s*((?:(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)\p{L}*\.?(?:\s+(?:de|of))?\s+(?:19|20)\d{2}|(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2})|atual|atualmente|presente|present|current|currently|hoje|now|today|o momento))(?![\p{L}\d/])/iu;
const OPEN_END = /^(?:atual|atualmente|presente|present|current|currently|hoje|now|today|o momento)$/iu;

const pad = (month: number): string => String(month).padStart(2, "0");

const numericYearMonth = (date: string): YearMonth | undefined => {
  const numeric = /^(\d{1,2})\/(\d{4})$/u.exec(date);

  return numeric ? `${numeric[2]}-${pad(Number(numeric[1]))}` : undefined;
};

const WORDED_DATE = /^(\p{L}+)\.?\s+(?:(?:de|of)\s+)?(\d{4})$/iu;

const monthNumberOf = (word: string): number | undefined => MONTHS[word] ?? MONTHS[word.slice(0, 3)];

const wordedYearMonth = (date: string): YearMonth | undefined => {
  const worded = WORDED_DATE.exec(normalise(date));

  if (!worded) {
    return undefined;
  }

  const month = monthNumberOf(worded[1] ?? "");

  return month === undefined ? undefined : `${worded[2]}-${pad(month)}`;
};

// A year alone starts in January and ends in December, so a whole year counts twelve months.
const yearMonthOf = (date: string, edge: "start" | "end"): YearMonth =>
  numericYearMonth(date) ?? wordedYearMonth(date) ?? `${date.slice(-4)}-${edge === "start" ? "01" : "12"}`;

const isOpenEnd = (text: string): boolean => OPEN_END.test(normalise(text));

const periodOf = ([, since, sinceDate, start, end]: RegExpExecArray): Period =>
  since
    ? { start: yearMonthOf(sinceDate ?? "", "start"), end: null }
    : { start: yearMonthOf(start ?? "", "start"), end: isOpenEnd(end ?? "") ? null : yearMonthOf(end ?? "", "end") };

// The first date range on the line, in Portuguese or English: month names or their
// abbreviations, MM/YYYY, or a year, joined by a dash, "a", "até", or "to", or open-ended
// with "present", "atual", and their kin, or introduced by "since" or "desde".
export function findDateRange(line: string): DateRangeMatch | undefined {
  const match = RANGE.exec(line);

  return match ? { period: periodOf(match), index: match.index, length: match[0].length } : undefined;
}

export const withoutDateRange = (line: string, match: DateRangeMatch): string =>
  `${line.slice(0, match.index)} ${line.slice(match.index + match.length)}`.replace(/\s+/gu, " ").trim();
