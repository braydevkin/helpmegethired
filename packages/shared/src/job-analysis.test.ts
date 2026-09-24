import { describe, expect, it } from "vitest";

import { JOB_DESCRIPTION_ID, REQUIREMENT_ID, citedStatement, rebuiltResume, requirement } from "./candidate.fixtures.js";
import {
  ACTIVE_JOB_ANALYSIS_STATUSES,
  JobAnalysisHistorySchema,
  JobAnalysisLayersSchema,
  JobAnalysisProgressSchema,
  JobAnalysisProgressStateSchema,
  JobAnalysisReanalysisSchema,
  JobAnalysisStatusSchema,
  JobDescriptionOverviewSchema,
  LAYER_ORDER,
  LayerSchema,
} from "./job-analysis.js";

const JOB_ANALYSIS_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const STATEMENT_ID = citedStatement.id;

const layer = (kind: string, status: string, overrides: Record<string, unknown> = {}) => ({
  kind,
  status,
  attempts: status === "pending" ? 0 : 1,
  failureReason: null,
  startedAt: status === "pending" ? null : "2026-09-24T10:00:00.000Z",
  completedAt: status === "completed" ? "2026-09-24T10:01:00.000Z" : null,
  ...overrides,
});

const pendingLayers = [layer("requirement_match", "pending"), layer("ats_score", "pending"), layer("resume_builder", "pending")];

const requirementMatch = {
  requirements: [requirement],
  matches: [{ id: "9f0a1b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c", requirementId: REQUIREMENT_ID, statementId: STATEMENT_ID, factId: null, reason: "The Statement describes running the platform." }],
  citedStatements: [citedStatement],
  citedFacts: [],
};
const atsScore = { score: 7, ruleSetVersion: "ats-rules-v1", breakdown: [{ requirementId: REQUIREMENT_ID, kind: "required", weight: 2, strength: true }] };

const queued = {
  jobAnalysisId: JOB_ANALYSIS_ID,
  jobDescriptionId: JOB_DESCRIPTION_ID,
  status: "queued",
  layers: pendingLayers,
  modelId: "claude-sonnet-5",
  failureReason: null,
  failedLayer: null,
  pauseReason: null,
  resumeAfter: null,
  outputs: { requirementMatch: null, atsScore: null, rebuiltResume: null },
  reanalysis: { allowed: false, refusal: "job_analysis_active" },
  createdAt: "2026-09-24T09:59:00.000Z",
  completedAt: null,
};

const completed = {
  ...queued,
  status: "completed",
  layers: [layer("requirement_match", "completed"), layer("ats_score", "completed"), layer("resume_builder", "completed")],
  outputs: { requirementMatch, atsScore, rebuiltResume },
  reanalysis: { allowed: false, refusal: "job_analysis_unchanged" },
  completedAt: "2026-09-24T10:05:00.000Z",
};

describe("JobAnalysisStatusSchema", () => {
  it("holds the active states among its own", () => {
    for (const status of ACTIVE_JOB_ANALYSIS_STATUSES) {
      expect(JobAnalysisStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(JobAnalysisStatusSchema.safeParse("done").success).toBe(false);
  });
});

describe("LayerSchema", () => {
  it("fixes the three Layers in their order", () => {
    expect(LAYER_ORDER).toEqual(["requirement_match", "ats_score", "resume_builder"]);
  });

  it("accepts a skipped Resume Builder", () => {
    expect(LayerSchema.safeParse(layer("resume_builder", "skipped")).success).toBe(true);
  });

  it("accepts a failed Layer with its reason", () => {
    expect(LayerSchema.safeParse(layer("requirement_match", "failed", { failureReason: "no_requirements" })).success).toBe(true);
  });

  it.each([
    ["a skipped Requirement Match", layer("requirement_match", "skipped")],
    ["a skipped ATS Score", layer("ats_score", "skipped")],
    ["a Layer of an unknown kind", layer("title_match", "pending")],
    ["a Layer with a Provider's own message as reason", layer("ats_score", "failed", { failureReason: "429 Too Many Requests" })],
    ["a Layer with negative attempts", layer("ats_score", "pending", { attempts: -1 })],
  ])("rejects %s", (_label, input) => {
    expect(LayerSchema.safeParse(input).success).toBe(false);
  });
});

describe("JobAnalysisLayersSchema", () => {
  it.each([
    ["nothing started", pendingLayers],
    ["the first Layer running", [layer("requirement_match", "running"), layer("ats_score", "pending"), layer("resume_builder", "pending")]],
    ["the score counted and the Resume Builder skipped", [layer("requirement_match", "completed"), layer("ats_score", "completed"), layer("resume_builder", "skipped")]],
    ["the first Layer failed and the rest waiting", [layer("requirement_match", "failed", { failureReason: "timeout" }), layer("ats_score", "pending"), layer("resume_builder", "pending")]],
  ])("accepts %s", (_label, input) => {
    expect(JobAnalysisLayersSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["Layers out of order", [layer("ats_score", "pending"), layer("requirement_match", "pending"), layer("resume_builder", "pending")]],
    ["a missing Layer", [layer("requirement_match", "pending"), layer("ats_score", "pending")]],
    ["a Layer twice", [layer("requirement_match", "pending"), layer("requirement_match", "pending"), layer("resume_builder", "pending")]],
    ["the score running before the Requirement Match completed", [layer("requirement_match", "running"), layer("ats_score", "running"), layer("resume_builder", "pending")]],
    ["the Resume Builder skipped before the score was counted", [layer("requirement_match", "completed"), layer("ats_score", "running"), layer("resume_builder", "skipped")]],
    ["the score counted after a failed Requirement Match", [layer("requirement_match", "failed", { failureReason: "timeout" }), layer("ats_score", "completed"), layer("resume_builder", "pending")]],
  ])("rejects %s", (_label, input) => {
    expect(JobAnalysisLayersSchema.safeParse(input).success).toBe(false);
  });
});

describe("JobAnalysisReanalysisSchema", () => {
  it.each([
    ["an allowed re-analysis", { allowed: true, refusal: null }],
    ["one refused as unchanged", { allowed: false, refusal: "job_analysis_unchanged" }],
    ["one refused while the Profile is changing", { allowed: false, refusal: "job_analysis_profile_busy" }],
    ["one refused without a completed Curation", { allowed: false, refusal: "curation_not_completed" }],
    ["one refused without a Model Key", { allowed: false, refusal: "model_key_missing" }],
  ])("accepts %s", (_label, input) => {
    expect(JobAnalysisReanalysisSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["an allowed re-analysis carrying a refusal", { allowed: true, refusal: "job_analysis_unchanged" }],
    ["a refused re-analysis with no code", { allowed: false, refusal: null }],
    ["a refusal that belongs to a retry", { allowed: false, refusal: "job_analysis_not_retryable" }],
    ["a refusal that belongs to a Curation", { allowed: false, refusal: "curation_active" }],
  ])("rejects %s", (_label, input) => {
    expect(JobAnalysisReanalysisSchema.safeParse(input).success).toBe(false);
  });
});

describe("JobAnalysisProgressSchema", () => {
  it("accepts a queued Job Analysis with nothing produced yet", () => {
    expect(JobAnalysisProgressSchema.safeParse(queued).success).toBe(true);
  });

  it("accepts a completed Job Analysis with every Layer's output", () => {
    expect(JobAnalysisProgressSchema.safeParse(completed).success).toBe(true);
  });

  it("accepts a completed Job Analysis whose Resume Builder was skipped", () => {
    const skipped = {
      ...completed,
      layers: [layer("requirement_match", "completed"), layer("ats_score", "completed"), layer("resume_builder", "skipped")],
      outputs: { requirementMatch, atsScore: { ...atsScore, score: 8 }, rebuiltResume: null },
    };
    expect(JobAnalysisProgressSchema.safeParse(skipped).success).toBe(true);
  });

  it("accepts a cancelled Job Analysis keeping the Layers it completed", () => {
    const cancelled = {
      ...queued,
      status: "cancelled",
      layers: [layer("requirement_match", "completed"), layer("ats_score", "pending"), layer("resume_builder", "pending")],
      outputs: { requirementMatch, atsScore: null, rebuiltResume: null },
      reanalysis: { allowed: true, refusal: null },
    };
    expect(JobAnalysisProgressSchema.safeParse(cancelled).success).toBe(true);
  });

  it("accepts a failed Job Analysis naming the Layer that stopped", () => {
    const failed = {
      ...queued,
      status: "failed",
      layers: [layer("requirement_match", "failed", { attempts: 3, failureReason: "invalid_output" }), layer("ats_score", "pending"), layer("resume_builder", "pending")],
      failureReason: "attempts_exhausted",
      failedLayer: "requirement_match",
      reanalysis: { allowed: true, refusal: null },
    };
    expect(JobAnalysisProgressSchema.safeParse(failed).success).toBe(true);
  });

  it("accepts a paused Job Analysis with its reason and resume time", () => {
    const paused = { ...queued, pauseReason: "provider_rate_limit", resumeAfter: "2026-09-24T10:30:00.000Z" };
    expect(JobAnalysisProgressSchema.safeParse(paused).success).toBe(true);
  });

  it.each([
    ["an output of a Layer that did not complete", { ...queued, outputs: { ...queued.outputs, atsScore } }],
    ["a completed Layer with no output", { ...completed, outputs: { ...completed.outputs, atsScore: null } }],
    ["a skipped Resume Builder with a Rebuilt Resume", { ...completed, layers: [layer("requirement_match", "completed"), layer("ats_score", "completed"), layer("resume_builder", "skipped")] }],
    ["a Layer named as failed on a Job Analysis that did not fail", { ...queued, failedLayer: "requirement_match" }],
    ["a pause reason the page cannot show", { ...queued, pauseReason: "quota" }],
    ["a failure reason the page cannot show", { ...queued, failureReason: "Anthropic: 401 Unauthorized" }],
    ["a score of 11 in the outputs", { ...completed, outputs: { ...completed.outputs, atsScore: { ...atsScore, score: 11 } } }],
    ["a Job Analysis with no re-analysis answer", { ...queued, reanalysis: undefined }],
  ])("rejects %s", (_label, input) => {
    expect(JobAnalysisProgressSchema.safeParse(input).success).toBe(false);
  });
});

describe("JobAnalysisProgressStateSchema", () => {
  it("accepts a Job Description with no Job Analysis yet", () => {
    expect(JobAnalysisProgressStateSchema.safeParse({ progress: null }).success).toBe(true);
  });

  it("rejects a missing progress", () => {
    expect(JobAnalysisProgressStateSchema.safeParse({}).success).toBe(false);
  });
});

describe("JobDescriptionOverviewSchema", () => {
  const summary = { id: JOB_ANALYSIS_ID, status: "completed", atsScore: 7, createdAt: queued.createdAt, completedAt: completed.completedAt };
  const overview = { id: JOB_DESCRIPTION_ID, text: "Senior Software Engineer.", createdAt: "2026-09-24T09:00:00.000Z", newestAnalysis: summary };

  it("accepts a Job Description with its newest Job Analysis", () => {
    expect(JobDescriptionOverviewSchema.safeParse(overview).success).toBe(true);
  });

  it("accepts one never analysed", () => {
    expect(JobDescriptionOverviewSchema.safeParse({ ...overview, newestAnalysis: null }).success).toBe(true);
  });

  it("accepts a history of summaries, and a queued one has no score yet", () => {
    expect(JobAnalysisHistorySchema.safeParse([summary, { ...summary, status: "queued", atsScore: null, completedAt: null }]).success).toBe(true);
  });

  it.each([
    ["a summary with a score over 10", { ...overview, newestAnalysis: { ...summary, atsScore: 11 } }],
    ["a summary with a fractional score", { ...overview, newestAnalysis: { ...summary, atsScore: 7.5 } }],
    ["a summary with an unknown status", { ...overview, newestAnalysis: { ...summary, status: "done" } }],
  ])("rejects %s", (_label, input) => {
    expect(JobDescriptionOverviewSchema.safeParse(input).success).toBe(false);
  });
});
