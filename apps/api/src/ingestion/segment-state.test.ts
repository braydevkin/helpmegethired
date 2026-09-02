import { describe, expect, it } from "vitest";

import { progressOf, statusAfter, stepsRemainingFor } from "./segment-state";

const ingestionId = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("stepsRemainingFor", () => {
  it.each([
    ["pending", ["read", "recognize", "save"]],
    ["read", ["recognize", "save"]],
    ["recognized", ["save"]],
    ["saved", []],
  ] as const)("continues a %s segment with %j", (status, steps) => {
    expect(stepsRemainingFor(status)).toEqual(steps);
  });
});

describe("statusAfter", () => {
  it.each([
    ["read", "read"],
    ["recognize", "recognized"],
    ["save", "saved"],
  ] as const)("moves a segment to %s once it is %s", (step, status) => {
    expect(statusAfter(step)).toBe(status);
  });
});

describe("progressOf", () => {
  it("counts every completed step of every segment", () => {
    const progress = progressOf(ingestionId, "running", ["saved", "read", "pending"]);

    expect(progress).toEqual({
      ingestionId,
      status: "running",
      percentage: 44,
      segments: { total: 3, saved: 1 },
    });
  });

  it("reaches 100 only when every segment is saved", () => {
    expect(progressOf(ingestionId, "running", ["saved", "recognized"]).percentage).toBe(83);
    expect(progressOf(ingestionId, "completed", ["saved", "saved"]).percentage).toBe(100);
  });

  it("starts at 0 for untouched segments", () => {
    expect(progressOf(ingestionId, "queued", ["pending", "pending"]).percentage).toBe(0);
  });

  it("treats an ingestion without segments as complete", () => {
    expect(progressOf(ingestionId, "completed", []).percentage).toBe(100);
  });
});
