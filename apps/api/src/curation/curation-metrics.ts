import type { CompanyDuration, CurationMetrics, Experience, Period } from "@helpmegethired/shared";

import { careerDuration } from "../parser";

export interface CountedProfile {
  experiences: readonly Pick<Experience, "company" | "period">[];
  projects: readonly unknown[];
  certifications: readonly unknown[];
  languages: readonly unknown[];
  education: readonly unknown[];
}

const periodsOf = (experiences: CountedProfile["experiences"]): Period[] =>
  experiences.flatMap((experience) => (experience.period ? [experience.period] : []));

// Two roles at one company share its time, so the company's periods go through the same merge
// as the whole career. Companies keep the order the Profile lists them in.
function durationPerCompanyOf(experiences: CountedProfile["experiences"], today: Date): CompanyDuration[] {
  const periodsByCompany = new Map<string, Period[]>();

  for (const { company, period } of experiences) {
    if (company !== null && period !== null) {
      periodsByCompany.set(company, [...(periodsByCompany.get(company) ?? []), period]);
    }
  }

  return [...periodsByCompany].map(([company, periods]) => ({ company, duration: careerDuration(periods, today) }));
}

export function curationMetricsOf(profile: CountedProfile, today: Date): CurationMetrics {
  return {
    careerDuration: careerDuration(periodsOf(profile.experiences), today),
    durationPerCompany: durationPerCompanyOf(profile.experiences, today),
    counts: {
      roles: profile.experiences.length,
      projects: profile.projects.length,
      certifications: profile.certifications.length,
      languages: profile.languages.length,
      education: profile.education.length,
    },
  };
}
