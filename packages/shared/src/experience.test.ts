import { describe, expect, it } from "vitest";

import { experience, without } from "./candidate.fixtures.js";
import { ExperienceSchema } from "./experience.js";

describe("ExperienceSchema", () => {
  it("accepts a current position with an open period", () => {
    expect(ExperienceSchema.safeParse(experience).success).toBe(true);
  });

  it("accepts a past position, one without a period, and one without a company", () => {
    expect(ExperienceSchema.safeParse({ ...experience, period: { start: "2018-01", end: "2021-02" } }).success).toBe(true);
    expect(ExperienceSchema.safeParse({ ...experience, period: null }).success).toBe(true);
    expect(ExperienceSchema.safeParse({ ...experience, company: null }).success).toBe(true);
  });

  it("defaults skills to an empty list", () => {
    expect(ExperienceSchema.parse(without(experience, "skills")).skills).toEqual([]);
  });

  it.each([
    ["a period with a day", { ...experience, period: { start: "2021-03-01", end: null } }],
    ["a period with no end key", { ...experience, period: { start: "2021-03" } }],
    ["a blank role", { ...experience, role: "" }],
    ["a blank skill", { ...experience, skills: ["TypeScript", " "] }],
  ])("rejects %s", (_label, input) => {
    expect(ExperienceSchema.safeParse(input).success).toBe(false);
  });
});
