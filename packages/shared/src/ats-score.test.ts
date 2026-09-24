import { describe, expect, it } from "vitest";

import { REQUIREMENT_ID } from "./candidate.fixtures.js";
import { ATS_SCORE_REBUILD_THRESHOLD, AtsScoreSchema, AtsScoreValueSchema, needsRebuild } from "./ats-score.js";

const OTHER_REQUIREMENT_ID = "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f";

const entry = { requirementId: REQUIREMENT_ID, kind: "required", weight: 2, strength: true };
const atsScore = { score: 7, ruleSetVersion: "ats-rules-v1", breakdown: [entry, { ...entry, requirementId: OTHER_REQUIREMENT_ID, kind: "preferred", weight: 1, strength: false }] };

describe("AtsScoreValueSchema", () => {
  it.each([0, 7, 8, 10])("accepts %s", (score) => {
    expect(AtsScoreValueSchema.safeParse(score).success).toBe(true);
  });

  it.each([11, -1, 7.5, "ten", "7", null])("rejects %s", (score) => {
    expect(AtsScoreValueSchema.safeParse(score).success).toBe(false);
  });
});

describe("AtsScoreSchema", () => {
  it("accepts a score with its rule set version and its breakdown per Requirement", () => {
    expect(AtsScoreSchema.safeParse(atsScore).success).toBe(true);
  });

  it.each([
    ["a score over 10", { ...atsScore, score: 11 }],
    ["a fractional score", { ...atsScore, score: 7.5 }],
    ["a score with no rule set version", { ...atsScore, ruleSetVersion: "" }],
    ["a score with an empty breakdown", { ...atsScore, breakdown: [] }],
    ["a breakdown listing a Requirement twice", { ...atsScore, breakdown: [entry, entry] }],
    ["a breakdown entry with no weight", { ...atsScore, breakdown: [{ ...entry, weight: 0 }] }],
    ["a breakdown entry with a fractional weight", { ...atsScore, breakdown: [{ ...entry, weight: 1.5 }] }],
  ])("rejects %s", (_label, input) => {
    expect(AtsScoreSchema.safeParse(input).success).toBe(false);
  });
});

describe("needsRebuild", () => {
  it("rebuilds below the threshold and skips at it or above", () => {
    expect(ATS_SCORE_REBUILD_THRESHOLD).toBe(8);
    expect(needsRebuild(7)).toBe(true);
    expect(needsRebuild(8)).toBe(false);
    expect(needsRebuild(10)).toBe(false);
  });
});
