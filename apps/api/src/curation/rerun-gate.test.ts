import { describe, expect, it } from "vitest";

import { isRerunAllowed, type CurationOrigin } from "./rerun-gate";

const origin: CurationOrigin = { sourceIngestionId: "11111111-1111-4111-8111-111111111111", modelId: "claude-sonnet-5", promptVersion: "curation/1" };

describe("isRerunAllowed", () => {
  it("refuses a re-run of an unchanged completed Curation", () => {
    expect(isRerunAllowed({ status: "completed" }, origin, origin)).toBe(false);
  });

  it.each(["failed", "cancelled"] as const)("allows one when the newest Curation of the Profile is %s", (status) => {
    expect(isRerunAllowed({ status }, origin, origin)).toBe(true);
  });

  it("allows one when the Profile has no Curation, or none completed", () => {
    expect(isRerunAllowed(undefined, origin, origin)).toBe(true);
    expect(isRerunAllowed({ status: "completed" }, undefined, origin)).toBe(true);
  });

  it.each([
    ["a newly confirmed Profile", { sourceIngestionId: "22222222-2222-4222-8222-222222222222" }],
    ["another Model", { modelId: "claude-opus-5" }],
    ["another prompt version", { promptVersion: "curation/2" }],
  ])("allows one for %s", (_change, changed) => {
    expect(isRerunAllowed({ status: "completed" }, origin, { ...origin, ...changed })).toBe(true);
  });
});
