import { describe, expect, it } from "vitest";

import { INGESTION_ID, curationMetrics as metrics, experience } from "./candidate.fixtures.js";
import {
  ACTIVE_CURATION_STATUSES,
  CurationProgressSchema,
  CurationProgressStateSchema,
  CurationSchema,
  CurationStatusSchema,
  CurationUnitSchema,
} from "./curation.js";

const CURATION_ID = "4b3c2d1e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";
const EXPERIENCE_UNIT_ID = "5c4d3e2f-6a7b-4c8d-9e0f-1a2b3c4d5e6f";
const SYNTHESIS_UNIT_ID = "6d5e4f3a-7b8c-4d9e-8f0a-2b3c4d5e6f7a";

const curation = {
  id: CURATION_ID,
  status: "queued",
  attempts: 0,
  maxAttempts: 3,
  sourceIngestionId: INGESTION_ID,
  createdAt: "2026-09-10T10:00:00.000Z",
  startedAt: null,
  completedAt: null,
  failureReason: null,
  resumeAfter: null,
};

describe("CurationSchema", () => {
  it("accepts a queued Curation that has not been attempted yet", () => {
    expect(CurationSchema.safeParse(curation).success).toBe(true);
  });

  it("accepts a Curation paused by a Provider rate limit until a given time", () => {
    expect(CurationSchema.safeParse({ ...curation, attempts: 1, resumeAfter: "2026-09-10T10:05:00.000Z" }).success).toBe(true);
  });

  it.each([
    ["an unknown status", { ...curation, status: "paused" }],
    ["a failure reason written as free text", { ...curation, status: "failed", failureReason: "overloaded_error: try again" }],
    ["negative attempts", { ...curation, attempts: -1 }],
    ["zero allowed attempts", { ...curation, maxAttempts: 0 }],
    ["a missing resume time", { ...curation, resumeAfter: undefined }],
    ["a source Ingestion that is not an id", { ...curation, sourceIngestionId: "latest" }],
  ])("rejects %s", (_label, input) => {
    expect(CurationSchema.safeParse(input).success).toBe(false);
  });
});

describe("ACTIVE_CURATION_STATUSES", () => {
  it("holds the Account only while queued or running, so the four terminal states free it", () => {
    const terminal = CurationStatusSchema.options.filter((status) => !(ACTIVE_CURATION_STATUSES as readonly string[]).includes(status));

    expect(terminal).toEqual(["completed", "failed", "cancelled", "superseded"]);
  });
});

const experienceUnit = {
  id: EXPERIENCE_UNIT_ID,
  kind: "experience",
  position: 0,
  status: "pending",
  attempts: 0,
  failureReason: null,
  truncated: false,
  subjectId: experience.id,
  title: "Senior Software Engineer at Analytical Engines Ltd",
};

const synthesisUnit = {
  ...experienceUnit,
  id: SYNTHESIS_UNIT_ID,
  kind: "synthesis",
  position: 1,
  subjectId: null,
  title: "The whole career, read together",
};

describe("CurationUnitSchema", () => {
  it("accepts an Experience unit that names its Experience", () => {
    expect(CurationUnitSchema.safeParse(experienceUnit).success).toBe(true);
  });

  it("accepts a synthesis unit with no subject", () => {
    expect(CurationUnitSchema.safeParse(synthesisUnit).success).toBe(true);
  });

  it("accepts a unit whose input was truncated and whose call timed out", () => {
    expect(CurationUnitSchema.safeParse({ ...experienceUnit, status: "failed", failureReason: "timeout", truncated: true }).success).toBe(true);
  });

  it.each([
    ["an Experience unit with no subject", { ...experienceUnit, subjectId: null }],
    ["a cross-cutting unit with a subject", { ...experienceUnit, kind: "cross_cutting" }],
    ["an unknown kind", { ...experienceUnit, kind: "education" }],
    ["a negative position", { ...experienceUnit, position: -1 }],
    ["a failure reason written as free text", { ...experienceUnit, status: "failed", failureReason: "529 Overloaded" }],
    ["an empty title", { ...experienceUnit, title: "" }],
  ])("rejects %s", (_label, input) => {
    expect(CurationUnitSchema.safeParse(input).success).toBe(false);
  });
});

describe("CurationProgressSchema", () => {
  const summaryOf = ({ id, kind, title, status, failureReason }: typeof experienceUnit | typeof synthesisUnit) => ({
    id,
    kind,
    title,
    status,
    failureReason,
  });

  const progress = {
    curationId: CURATION_ID,
    status: "running",
    percentage: 50,
    units: {
      total: 2,
      saved: 1,
      list: [summaryOf({ ...experienceUnit, status: "saved" }), summaryOf({ ...synthesisUnit, status: "running" })],
    },
    metrics,
    modelId: "claude-sonnet-5",
    failureReason: null,
    resumeAfter: null,
    pauseReason: null,
    rerun: { allowed: true, refusal: null },
  };

  it("accepts the counts, the units with their states, the metrics and the model", () => {
    expect(CurationProgressSchema.safeParse(progress).success).toBe(true);
  });

  it("accepts a Curation paused at the Account's embedding ceiling until a given time", () => {
    const paused = { ...progress, status: "queued", resumeAfter: "2026-09-12T00:00:00.000Z", pauseReason: "embedding_ceiling" };

    expect(CurationProgressSchema.safeParse(paused).success).toBe(true);
  });

  it("accepts a re-run refused with the code the endpoint would answer", () => {
    expect(CurationProgressSchema.safeParse({ ...progress, rerun: { allowed: false, refusal: "curation_unchanged" } }).success).toBe(true);
  });

  it.each([
    ["a total that differs from the units listed", { ...progress, units: { ...progress.units, total: 3 } }],
    ["a saved count that differs from the saved units", { ...progress, units: { ...progress.units, saved: 2 } }],
    ["a percentage above 100", { ...progress, percentage: 101 }],
    ["a fractional percentage", { ...progress, percentage: 50.5 }],
    ["missing metrics", { ...progress, metrics: undefined }],
    ["a refusal on a re-run that is allowed", { ...progress, rerun: { allowed: true, refusal: "curation_unchanged" } }],
    ["a refused re-run without its refusal", { ...progress, rerun: { allowed: false, refusal: null } }],
    ["a refusal a re-run never answers", { ...progress, rerun: { allowed: false, refusal: "curation_not_retryable" } }],
    ["a missing re-run gate", { ...progress, rerun: undefined }],
    ["a pause reason the platform never gives", { ...progress, pauseReason: "quota_exceeded" }],
    ["a missing pause reason", { ...progress, pauseReason: undefined }],
  ])("rejects %s", (_label, input) => {
    expect(CurationProgressSchema.safeParse(input).success).toBe(false);
  });

  it("answers an Account with no Curation as progress null, and never an absent field", () => {
    expect(CurationProgressStateSchema.safeParse({ progress: null }).success).toBe(true);
    expect(CurationProgressStateSchema.safeParse({ progress }).success).toBe(true);
    expect(CurationProgressStateSchema.safeParse({}).success).toBe(false);
  });
});
