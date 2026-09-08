import { describe, expect, it } from "vitest";

import { certification, education, language, skill } from "./candidate.fixtures.js";
import { CertificationSchema, EducationSchema, LanguageSchema, SkillSchema } from "./profile-parts.js";

describe("Profile part schemas", () => {
  it("accept the fixtures", () => {
    expect(EducationSchema.safeParse(education).success).toBe(true);
    expect(SkillSchema.safeParse(skill).success).toBe(true);
    expect(LanguageSchema.safeParse(language).success).toBe(true);
    expect(CertificationSchema.safeParse(certification).success).toBe(true);
  });

  it("accept an entry with only what the resume said", () => {
    expect(EducationSchema.safeParse({ ...education, degree: null, fieldOfStudy: null, period: null }).success).toBe(true);
    expect(LanguageSchema.safeParse({ ...language, level: null }).success).toBe(true);
    expect(CertificationSchema.safeParse({ ...certification, issuer: null, year: null }).success).toBe(true);
  });

  it.each([
    ["an education entry without an institution", EducationSchema, { ...education, institution: "" }],
    ["a skill outside the four categories", SkillSchema, { ...skill, category: "Databases" }],
    ["a language without a name", LanguageSchema, { ...language, name: " " }],
    ["a certification year out of range", CertificationSchema, { ...certification, year: 1800 }],
  ])("reject %s", (_label, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});
