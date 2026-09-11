import { describe, expect, it } from "vitest";

import { isRerunAllowed, rerunRefusalOf, type CurationOrigin, type RerunFacts } from "./rerun-gate";

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

describe("rerunRefusalOf", () => {
  const ready: RerunFacts = {
    active: false,
    readiness: { ingestionId: origin.sourceIngestionId, modelId: "claude-sonnet-5" },
    latest: { status: "completed" },
    current: origin,
  };

  it("answers curation_unchanged for an unchanged completed Curation", () => {
    expect(rerunRefusalOf(ready, origin.promptVersion)).toBe("curation_unchanged");
  });

  it("answers curation_active while a Curation is queued or running, before any other rule", () => {
    expect(rerunRefusalOf({ ...ready, active: true }, "curation/2")).toBe("curation_active");
    expect(rerunRefusalOf({ ...ready, active: true, readiness: undefined }, origin.promptVersion)).toBe("curation_active");
  });

  it("answers curation_not_ready when the Profile is not confirmed or no Model Key is stored", () => {
    expect(rerunRefusalOf({ ...ready, readiness: undefined }, "curation/2")).toBe("curation_not_ready");
  });

  it("answers no refusal once the prompt version or the Model changed, or nothing completed", () => {
    expect(rerunRefusalOf(ready, "curation/2")).toBeNull();
    expect(rerunRefusalOf({ ...ready, current: { ...origin, modelId: "claude-sonnet-4" } }, origin.promptVersion)).toBeNull();
    expect(rerunRefusalOf({ ...ready, latest: { status: "failed" } }, origin.promptVersion)).toBeNull();
    expect(rerunRefusalOf({ ...ready, latest: undefined, current: undefined }, origin.promptVersion)).toBeNull();
  });
});
