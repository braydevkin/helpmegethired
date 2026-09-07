import { describe, expect, it } from "vitest";

import { PeriodSchema, ProfileDraftSchema, YearMonthSchema, fieldOf } from "./profile-draft.js";
import { TextSchema } from "./primitives.js";

const emptyDraft = {
  parserVersion: "rules/1",
  basicProfile: { headline: null, summary: null, linkedinUrl: null, githubUrl: null },
  experiences: [],
  education: [],
  projects: [],
  skills: [],
  languages: [],
  certifications: [],
};

describe("ProfileDraftSchema", () => {
  it("accepts a draft with every part empty", () => {
    expect(ProfileDraftSchema.parse(emptyDraft)).toEqual(emptyDraft);
  });

  it("wraps every recognised field with its Confidence", () => {
    const draft = ProfileDraftSchema.parse({
      ...emptyDraft,
      basicProfile: {
        headline: { value: "Backend engineer", confidence: "medium" },
        summary: null,
        linkedinUrl: { value: "https://www.linkedin.com/in/ada", confidence: "high" },
        githubUrl: null,
      },
      skills: [{ name: "Node.js", category: "Languages & runtimes", confidence: "high" }],
    });

    expect(draft.basicProfile.headline).toEqual({ value: "Backend engineer", confidence: "medium" });
    expect(() => fieldOf(TextSchema).parse({ value: "x", confidence: "certain" })).toThrow();
  });

  it("keeps periods to the month with an open end for a held position", () => {
    expect(YearMonthSchema.safeParse("2021-03").success).toBe(true);
    expect(YearMonthSchema.safeParse("2021-13").success).toBe(false);
    expect(YearMonthSchema.safeParse("2021-03-01").success).toBe(false);
    expect(PeriodSchema.parse({ start: "2019-01", end: null })).toEqual({ start: "2019-01", end: null });
  });

  it("rejects a skill outside the four categories", () => {
    expect(() => ProfileDraftSchema.parse({ ...emptyDraft, skills: [{ name: "Go", category: "Tools", confidence: "high" }] })).toThrow();
  });
});
