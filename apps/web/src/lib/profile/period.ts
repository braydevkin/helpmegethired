import type { Experience, Period, YearMonth } from "@helpmegethired/shared";

const PRESENT = "present";

const yearOf = (yearMonth: YearMonth): number => Number(yearMonth.slice(0, 4));

// A résumé reads by year, so the month a period carries stays out of the label.
export const periodLabelOf = (period: Period): string => `${yearOf(period.start)} — ${period.end === null ? PRESENT : yearOf(period.end)}`;

// The span beside the Experience heading: the first year worked, then the last one, or
// `present` while a position is still held.
export function careerSpanOf(experiences: readonly Experience[]): string | null {
  const periods = experiences.flatMap((experience) => (experience.period ? [experience.period] : []));
  const ends = periods.flatMap((period) => (period.end === null ? [] : [yearOf(period.end)]));

  if (periods.length === 0) {
    return null;
  }

  const last = ends.length === periods.length ? Math.max(...ends) : PRESENT;

  return `${Math.min(...periods.map((period) => yearOf(period.start)))} — ${last}`;
}
