import type { Duration, FactKind, Id, Period } from "@helpmegethired/shared";

import { careerDuration } from "../parser";

export interface FactSources {
  experiences: readonly { period: Period | null }[];
  education: readonly { id: Id; institution: string; degree: string | null; fieldOfStudy: string | null; period: Period | null }[];
  certifications: readonly { id: Id; name: string; issuer: string | null; year: number | null }[];
  languages: readonly { id: Id; name: string; level: string | null }[];
  skills: readonly { id: Id; name: string; category: string }[];
}

export interface NewFact {
  kind: FactKind;
  text: string;
  sourceId: Id | null;
}

const joined = (parts: readonly (string | number | null)[]): string => parts.filter((part) => part !== null && part !== "").join(", ");

const periodText = ({ start, end }: Period): string => (end === null ? `since ${start}` : `${start} to ${end}`);

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"}`;

const durationText = ({ years, months }: Duration): string => {
  if (years === 0) {
    return plural(months, "month");
  }

  return months === 0 ? plural(years, "year") : `${plural(years, "year")} and ${plural(months, "month")}`;
};

const fact = (kind: FactKind, label: string, parts: readonly (string | number | null)[], sourceId: Id | null): NewFact => ({
  kind,
  text: `${label}: ${joined(parts)}`,
  sourceId,
});

// Every Fact is written by code from the confirmed Profile, with no Model call, so a Requirement
// such as "5 years of experience" or "a degree in computer science" is answered by a counted fact
// and never by a sentence the Model wrote about it (ADR-0026). The years come first, then the
// rows in the order the Profile lists them.
export function factsOf(profile: FactSources, today: Date): NewFact[] {
  const periods = profile.experiences.flatMap((experience) => (experience.period ? [experience.period] : []));

  return [
    fact("years_of_experience", "Years of experience", [durationText(careerDuration(periods, today))], null),
    ...profile.education.map((entry) =>
      fact("education", "Education", [joined([entry.degree, entry.fieldOfStudy]).replace(", ", " in "), entry.institution, entry.period && periodText(entry.period)], entry.id),
    ),
    ...profile.certifications.map((entry) => fact("certification", "Certification", [entry.name, entry.issuer, entry.year], entry.id)),
    ...profile.languages.map((entry) => fact("language", "Language", [entry.name, entry.level], entry.id)),
    ...profile.skills.map((entry) => fact("skill", "Skill", [`${entry.name} (${entry.category})`], entry.id)),
  ];
}
