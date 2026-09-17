import { describe, expect, it } from "vitest";

import { certification, education, experience, language, project, skill } from "./candidate.fixtures.js";
import {
  CertificationCorrectionSchema,
  EducationCorrectionSchema,
  ExperienceCorrectionSchema,
  LanguageCorrectionSchema,
  PROFILE_ENTRY_CORRECTION_SCHEMAS,
  ProfileCorrectionsSchema,
  ProfileListPartSchema,
  ProjectCorrectionSchema,
  SkillCorrectionSchema,
} from "./profile-correction.js";

describe("the entry correction schemas", () => {
  it.each([
    ["an Experience", ExperienceCorrectionSchema, experience],
    ["an Education entry", EducationCorrectionSchema, education],
    ["a Project", ProjectCorrectionSchema, project],
    ["a Skill", SkillCorrectionSchema, skill],
    ["a Language", LanguageCorrectionSchema, language],
    ["a Certification", CertificationCorrectionSchema, certification],
  ])("takes %s as the Profile answers it and keeps no id from the body", (_label, schema, entry) => {
    expect(schema.parse(entry)).not.toHaveProperty("id");
  });

  it("refuses to take the id from the body, which the path names", () => {
    expect(ExperienceCorrectionSchema.strict().safeParse(experience).success).toBe(false);
  });

  it.each([
    ["an Experience with no role", ExperienceCorrectionSchema, { ...experience, role: "" }],
    ["a Skill in a category the dictionary does not have", SkillCorrectionSchema, { ...skill, category: "Hobbies" }],
    ["a Certification from before the calendar", CertificationCorrectionSchema, { ...certification, year: 1899 }],
  ])("rejects %s", (_label, schema, entry) => {
    expect(schema.safeParse(entry).success).toBe(false);
  });

  it.each([
    ["an Experience", ExperienceCorrectionSchema, experience],
    ["an Education entry", EducationCorrectionSchema, education],
  ])("refuses %s that ends before it starts, on the month it ended", (_label, schema, entry) => {
    const result = schema.safeParse({ ...entry, period: { start: "2024-06", end: "2022-03" } });

    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["period.end"]);
  });

  it.each([
    ["one month long", { start: "2022-03", end: "2022-03" }],
    ["still open", { start: "2022-03", end: null }],
  ])("takes a period %s", (_label, period) => {
    expect(ExperienceCorrectionSchema.safeParse({ ...experience, period }).success).toBe(true);
  });

  it("has one schema per part that holds a list of entries", () => {
    expect(Object.keys(PROFILE_ENTRY_CORRECTION_SCHEMAS)).toEqual([...ProfileListPartSchema.options]);
  });
});

describe("ProfileCorrectionsSchema", () => {
  it("accepts a Profile nothing has been corrected on", () => {
    expect(ProfileCorrectionsSchema.safeParse({ basicProfile: false, entryIds: [] }).success).toBe(true);
  });

  it("rejects an entry id that is not an id", () => {
    expect(ProfileCorrectionsSchema.safeParse({ basicProfile: false, entryIds: ["the first one"] }).success).toBe(false);
  });
});
