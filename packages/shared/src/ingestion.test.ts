import { describe, expect, it } from "vitest";

import { ACCOUNT_ID } from "./candidate.fixtures.js";
import { IngestionProgressSchema, IngestionSchema, SegmentStatusSchema } from "./ingestion.js";

const ingestion = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  accountId: ACCOUNT_ID,
  status: "queued",
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  createdAt: "2026-09-02T10:00:00.000Z",
  updatedAt: "2026-09-02T10:00:00.000Z",
};

describe("IngestionSchema", () => {
  it("accepts a queued Ingestion that has not been attempted yet", () => {
    expect(IngestionSchema.safeParse(ingestion).success).toBe(true);
  });

  it.each([
    ["an unknown status", { ...ingestion, status: "paused" }],
    ["negative attempts", { ...ingestion, attempts: -1 }],
    ["zero allowed attempts", { ...ingestion, maxAttempts: 0 }],
    ["a missing last error", { ...ingestion, lastError: undefined }],
  ])("rejects %s", (_label, input) => {
    expect(IngestionSchema.safeParse(input).success).toBe(false);
  });
});

describe("SegmentStatusSchema", () => {
  it("lists the states in the order a Segment moves through them", () => {
    expect(SegmentStatusSchema.options).toEqual(["pending", "read", "recognized", "saved"]);
  });
});

describe("IngestionProgressSchema", () => {
  const progress = {
    ingestionId: ingestion.id,
    status: "running",
    percentage: 44,
    segments: { total: 3, saved: 1 },
  };

  it("accepts a percentage between 0 and 100 with the segment counts", () => {
    expect(IngestionProgressSchema.safeParse(progress).success).toBe(true);
  });

  it.each([
    ["a percentage above 100", { ...progress, percentage: 101 }],
    ["a fractional percentage", { ...progress, percentage: 44.4 }],
    ["more saved segments than total", { ...progress, segments: { total: 3, saved: -1 } }],
  ])("rejects %s", (_label, input) => {
    expect(IngestionProgressSchema.safeParse(input).success).toBe(false);
  });
});
