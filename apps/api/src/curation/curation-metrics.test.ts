import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { CurationMetricsSchema, ProfileDraftSchema, type ProfileDraft } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { curationMetricsOf, type CountedProfile } from "./curation-metrics";

const today = new Date("2026-09-10T12:00:00Z");

const emptyProfile: CountedProfile = { experiences: [], projects: [], certifications: [], languages: [], education: [] };

describe("curationMetricsOf", () => {
  it("counts two overlapping roles at one company once, for the company and for the career", () => {
    const metrics = curationMetricsOf(
      {
        ...emptyProfile,
        experiences: [
          { company: "Parapet Systems", period: { start: "2019-01", end: "2021-12" } },
          { company: "Parapet Systems", period: { start: "2020-01", end: "2022-12" } },
        ],
      },
      today,
    );

    expect(metrics.careerDuration).toEqual({ years: 4, months: 0 });
    expect(metrics.durationPerCompany).toEqual([{ company: "Parapet Systems", duration: { years: 4, months: 0 } }]);
    expect(metrics.counts.roles).toBe(2);
  });

  it("runs an open period to the injected day", () => {
    const metrics = curationMetricsOf({ ...emptyProfile, experiences: [{ company: "Glacis Labs", period: { start: "2026-01", end: null } }] }, today);

    expect(metrics.careerDuration).toEqual({ years: 0, months: 9 });
  });

  it("counts a role with no company or no period, and leaves it out of the time per company", () => {
    const metrics = curationMetricsOf(
      {
        ...emptyProfile,
        experiences: [
          { company: null, period: { start: "2018-01", end: "2018-12" } },
          { company: "Rampart Cloud", period: null },
        ],
      },
      today,
    );

    expect(metrics.careerDuration).toEqual({ years: 1, months: 0 });
    expect(metrics.durationPerCompany).toEqual([]);
    expect(metrics.counts.roles).toBe(2);
  });

  it("answers zero for a Profile with no Experience", () => {
    expect(curationMetricsOf(emptyProfile, today)).toEqual({
      careerDuration: { years: 0, months: 0 },
      durationPerCompany: [],
      counts: { roles: 0, projects: 0, certifications: 0, languages: 0, education: 0 },
    });
  });
});

const corpus = join(__dirname, "../../test/fixtures/resumes/corpus/expected");

const countedProfileOf = (draft: ProfileDraft): CountedProfile => ({
  experiences: draft.experiences.map((experience) => ({
    company: experience.company?.value ?? null,
    period: experience.period?.value ?? null,
  })),
  projects: draft.projects,
  certifications: draft.certifications,
  languages: draft.languages,
  education: draft.education,
});

const drafts = readdirSync(corpus)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name): [string, ProfileDraft] => [
    name.replace(/\.json$/u, ""),
    ProfileDraftSchema.parse((JSON.parse(readFileSync(join(corpus, name), "utf8")) as { draft: unknown }).draft),
  ]);

describe("curationMetricsOf over the synthetic corpus", () => {
  it.each(drafts)("%s gives metrics that validate and count every part", (_slug, draft) => {
    const metrics = curationMetricsOf(countedProfileOf(draft), today);

    expect(CurationMetricsSchema.parse(metrics)).toEqual(metrics);
    expect(metrics.counts).toEqual({
      roles: draft.experiences.length,
      projects: draft.projects.length,
      certifications: draft.certifications.length,
      languages: draft.languages.length,
      education: draft.education.length,
    });
  });

  it("merges adjacent roles into one career for the single-column English resume", () => {
    const draft = new Map(drafts).get("ada-single-column-en");

    expect(draft && curationMetricsOf(countedProfileOf(draft), today)).toEqual({
      careerDuration: { years: 10, months: 4 },
      durationPerCompany: [
        { company: "Analytical Engines Ltd", duration: { years: 5, months: 7 } },
        { company: "Difference Works", duration: { years: 4, months: 9 } },
      ],
      counts: { roles: 2, projects: 1, certifications: 1, languages: 2, education: 2 },
    });
  });

  it("includes a resume whose Experiences the parser could not read", () => {
    const withoutExperience = drafts.filter(([, draft]) => draft.experiences.length === 0);

    expect(withoutExperience.length).toBeGreaterThan(0);
    for (const [, draft] of withoutExperience) {
      expect(curationMetricsOf(countedProfileOf(draft), today).careerDuration).toEqual({ years: 0, months: 0 });
    }
  });
});
