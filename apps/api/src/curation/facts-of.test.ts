import { describe, expect, it } from "vitest";

import { factsOf, type FactSources } from "./facts-of";

const today = new Date("2026-09-24T10:00:00.000Z");

const EDUCATION_ID = "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c";
const CERTIFICATION_ID = "3a6d4c8e-1f5b-4a0c-9d7e-4b8c0f3e5a7d";
const LANGUAGE_ID = "4b7e5d9f-2a6c-4b1d-8e8f-5c9d1a4f6b8e";
const SKILL_ID = "5c8f6e0a-3b7d-4c2e-9f9a-6d0e2b5a7c9f";

const empty: FactSources = { experiences: [], education: [], certifications: [], languages: [], skills: [] };

const profile: FactSources = {
  experiences: [
    { period: { start: "2016-01", end: "2019-06" } },
    { period: { start: "2019-01", end: "2021-12" } },
    { period: null },
  ],
  education: [{ id: EDUCATION_ID, institution: "University of Cambridge", degree: "MSc", fieldOfStudy: "Computer Science", period: { start: "2014-01", end: "2016-12" } }],
  certifications: [{ id: CERTIFICATION_ID, name: "Solutions Architect", issuer: "Amazon Web Services", year: 2021 }],
  languages: [{ id: LANGUAGE_ID, name: "English", level: "fluent" }],
  skills: [{ id: SKILL_ID, name: "TypeScript", category: "Languages & runtimes" }],
};

describe("factsOf", () => {
  it("counts the years of experience first, merging overlapping periods as the career duration does", () => {
    expect(factsOf(profile, today)[0]).toEqual({ kind: "years_of_experience", text: "Years of experience: 6 years", sourceId: null });
  });

  it("restates each Education, Certification, Language, and Skill with the id of its row, in Profile order", () => {
    expect(factsOf(profile, today).slice(1)).toEqual([
      { kind: "education", text: "Education: MSc in Computer Science, University of Cambridge, 2014-01 to 2016-12", sourceId: EDUCATION_ID },
      { kind: "certification", text: "Certification: Solutions Architect, Amazon Web Services, 2021", sourceId: CERTIFICATION_ID },
      { kind: "language", text: "Language: English, fluent", sourceId: LANGUAGE_ID },
      { kind: "skill", text: "Skill: TypeScript (Languages & runtimes)", sourceId: SKILL_ID },
    ]);
  });

  it("records the years of experience alone for a Profile with nothing else to count", () => {
    expect(factsOf(empty, today)).toEqual([{ kind: "years_of_experience", text: "Years of experience: 0 months", sourceId: null }]);
  });

  // The career merge counts months inclusively: a role held from September to September is
  // thirteen months, and one that started this month is one.
  it.each([
    ["a role still held since last September", [{ period: { start: "2025-09", end: null } }], "1 year and 1 month"],
    ["a role that started this month", [{ period: { start: "2026-09", end: null } }], "1 month"],
    ["years and months", [{ period: { start: "2024-01", end: "2026-04" } }], "2 years and 4 months"],
  ])("words the duration of %s", (_label, experiences, expected) => {
    expect(factsOf({ ...empty, experiences }, today)[0]?.text).toBe(`Years of experience: ${expected}`);
  });

  it("leaves out the parts a row does not have", () => {
    const sparse: FactSources = {
      ...empty,
      education: [{ id: EDUCATION_ID, institution: "MIT", degree: null, fieldOfStudy: null, period: null }],
      certifications: [{ id: CERTIFICATION_ID, name: "Scrum Master", issuer: null, year: null }],
      languages: [{ id: LANGUAGE_ID, name: "Portuguese", level: null }],
    };

    expect(factsOf(sparse, today).slice(1).map((fact) => fact.text)).toEqual(["Education: MIT", "Certification: Scrum Master", "Language: Portuguese"]);
  });

  it("names a degree without a field and a field without a degree", () => {
    const education = [
      { id: EDUCATION_ID, institution: "MIT", degree: "BSc", fieldOfStudy: null, period: null },
      { id: EDUCATION_ID, institution: "MIT", degree: null, fieldOfStudy: "Physics", period: { start: "2010-09", end: null } },
    ];

    expect(factsOf({ ...empty, education }, today).slice(1).map((fact) => fact.text)).toEqual(["Education: BSc, MIT", "Education: Physics, MIT, since 2010-09"]);
  });
});
