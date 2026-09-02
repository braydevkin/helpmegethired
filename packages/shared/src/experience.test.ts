import { describe, expect, it } from "vitest";

import { experience, without } from "./candidate.fixtures.js";
import { ExperienceSchema } from "./experience.js";

describe("ExperienceSchema", () => {
  it("accepts a current position with an open end date", () => {
    expect(ExperienceSchema.safeParse(experience).success).toBe(true);
  });

  it("accepts a past position whose end date follows its start date", () => {
    const past = { ...experience, startDate: "2018-01-01", endDate: "2021-02-28" };
    expect(ExperienceSchema.safeParse(past).success).toBe(true);
  });

  it("defaults skills to an empty list", () => {
    expect(ExperienceSchema.parse(without(experience, "skills")).skills).toEqual([]);
  });

  it.each([
    ["an end date before the start date", { ...experience, startDate: "2021-03-01", endDate: "2020-12-31" }],
    ["a start date with a time component", { ...experience, startDate: "2021-03-01T00:00:00Z" }],
    ["a missing end date", without(experience, "endDate")],
    ["a blank company", { ...experience, company: "" }],
    ["a blank skill", { ...experience, skills: ["TypeScript", " "] }],
  ])("rejects %s", (_label, input) => {
    expect(ExperienceSchema.safeParse(input).success).toBe(false);
  });
});
