import type { Duration, Period, YearMonth } from "@helpmegethired/shared";

interface MonthSpan {
  start: number;
  end: number;
}

const MONTHS_PER_YEAR = 12;

const indexOf = (yearMonth: YearMonth): number => {
  const [year, month] = yearMonth.split("-").map(Number);

  return (year ?? 0) * MONTHS_PER_YEAR + (month ?? 1) - 1;
};

export const yearMonthOf = (date: Date): YearMonth =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

// Months covered by the periods with the overlaps counted once: sorted by start, merged when
// one starts before or right after the previous one ends, then summed, both ends inclusive.
// An open period ends today, so a held position keeps growing.
function careerMonths(periods: readonly Period[], today: Date): number {
  const now = indexOf(yearMonthOf(today));
  const spans = periods
    .map((period) => ({ start: indexOf(period.start), end: period.end === null ? now : indexOf(period.end) }))
    .filter((span) => span.end >= span.start)
    .sort((left, right) => left.start - right.start);
  const merged: MonthSpan[] = [];

  for (const span of spans) {
    const last = merged.at(-1);

    if (last && span.start <= last.end + 1) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }

  return merged.reduce((total, span) => total + span.end - span.start + 1, 0);
}

export function careerDuration(periods: readonly Period[], today: Date): Duration {
  const months = careerMonths(periods, today);

  return { years: Math.floor(months / MONTHS_PER_YEAR), months: months % MONTHS_PER_YEAR };
}
