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

const MONTH_WORD = "(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[\\p{L}]*\\.?";
const YEAR = "(?:19|20)\\d{2}";
const DATE = `(?:${MONTH_WORD}(?:\\s+(?:de|of))?\\s+${YEAR}|(?:0?[1-9]|1[0-2])\\/${YEAR}|${YEAR})`;
const OPEN_END = "(?:atual|atualmente|presente|present|current|currently|hoje|now|today|o momento)";
const SEPARATOR = "\\s*(?:-|–|—|a|até|ate|to)\\s*";
const SINCE = "(?:desde|since)\\s+";

const RANGE = new RegExp(`(?<![\\p{L}\\d/])(?:(${SINCE})(${DATE})|(${DATE})${SEPARATOR}(${DATE}|${OPEN_END}))(?![\\p{L}\\d/])`, "iu");

const pad = (month: number): string => String(month).padStart(2, "0");

// A year alone starts in January and ends in December, so a whole year counts twelve months.
function yearMonthOf(date: string, edge: "start" | "end"): YearMonth {
  const numeric = /^(\d{1,2})\/(\d{4})$/u.exec(date);

  if (numeric) {
    return `${numeric[2]}-${pad(Number(numeric[1]))}`;
  }

  const worded = /^(\p{L}+)\.?\s+(?:(?:de|of)\s+)?(\d{4})$/iu.exec(normalise(date));

  if (worded) {
    const month = MONTHS[worded[1] ?? ""] ?? MONTHS[(worded[1] ?? "").slice(0, 3)];

    if (month !== undefined) {
      return `${worded[2]}-${pad(month)}`;
    }
  }

  return `${date.slice(-4)}-${edge === "start" ? "01" : "12"}`;
}

const isOpenEnd = (text: string): boolean => new RegExp(`^${OPEN_END}$`, "iu").test(normalise(text));

// The first date range on the line, in Portuguese or English: month names or their
// abbreviations, MM/YYYY, or a year, joined by a dash, "a", "até", or "to", or open-ended
// with "present", "atual", and their kin, or introduced by "since" or "desde".
export function findDateRange(line: string): DateRangeMatch | undefined {
  const match = RANGE.exec(line);

  if (!match || match.index === undefined) {
    return undefined;
  }

  const [whole, since, sinceDate, start, end] = match;
  const period: Period = since
    ? { start: yearMonthOf(sinceDate ?? "", "start"), end: null }
    : { start: yearMonthOf(start ?? "", "start"), end: isOpenEnd(end ?? "") ? null : yearMonthOf(end ?? "", "end") };

  return { period, index: match.index, length: whole.length };
}

export const withoutDateRange = (line: string, match: DateRangeMatch): string =>
  `${line.slice(0, match.index)} ${line.slice(match.index + match.length)}`.replace(/\s+/gu, " ").trim();
