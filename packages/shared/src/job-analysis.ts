import { z } from "zod";

import { AtsScoreSchema, AtsScoreValueSchema } from "./ats-score.js";
import { CurationPauseReasonSchema } from "./curation.js";
import { JobDescriptionErrorCodeSchema, JobDescriptionSchema } from "./job-description.js";
import { ModelChoiceErrorCodeSchema } from "./model-choice.js";
import { IdSchema, TextSchema, TimestampSchema, listOf } from "./primitives.js";
import { RequirementMatchResultSchema } from "./requirement-match.js";
import { RebuiltResumeSchema } from "./resume.js";

export const JobAnalysisStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled", "superseded"]);
export type JobAnalysisStatus = z.infer<typeof JobAnalysisStatusSchema>;

// The states that hold the Account's one active Job Analysis; every other state frees it.
export const ACTIVE_JOB_ANALYSIS_STATUSES = ["queued", "running"] as const satisfies readonly JobAnalysisStatus[];

// The order is fixed and code runs it; nothing chooses what runs next (ADR-0026).
export const LayerKindSchema = z.enum(["requirement_match", "ats_score", "resume_builder"]);
export type LayerKind = z.infer<typeof LayerKindSchema>;

export const LAYER_ORDER = LayerKindSchema.options;

export const LayerStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped"]);
export type LayerStatus = z.infer<typeof LayerStatusSchema>;

// Closed lists, so a row or a response never carries a Provider's own message, which can echo
// the input it refused (docs/security.md, "AI pipeline"). `no_requirements` is the one reason
// that is never retried: the Job Description, not the call, produced nothing.
export const LayerFailureReasonSchema = z.enum(["timeout", "invalid_output", "truncated_response", "provider_error", "no_requirements"]);
export type LayerFailureReason = z.infer<typeof LayerFailureReasonSchema>;

export const JobAnalysisFailureReasonSchema = z.enum(["attempts_exhausted", "model_key_rejected", "no_requirements"]);
export type JobAnalysisFailureReason = z.infer<typeof JobAnalysisFailureReasonSchema>;

// A Job Analysis pauses for the two reasons a Curation does: the Candidate's Provider asked to
// slow down, or the Account used the platform's embedding allowance for the day.
export const JobAnalysisPauseReasonSchema = CurationPauseReasonSchema;
export type JobAnalysisPauseReason = z.infer<typeof JobAnalysisPauseReasonSchema>;

const LayerFieldsSchema = z.object({
  kind: LayerKindSchema,
  status: LayerStatusSchema,
  attempts: z.int().nonnegative(),
  failureReason: LayerFailureReasonSchema.nullable(),
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
});

// Only the Resume Builder is ever skipped: it runs below the rebuild threshold and not at or
// above it, and a skipped Layer still lets the Job Analysis complete.
export const LayerSchema = LayerFieldsSchema.refine((layer) => layer.status !== "skipped" || layer.kind === "resume_builder", {
  message: "Only the Resume Builder can be skipped",
  path: ["status"],
});

export type Layer = z.infer<typeof LayerSchema>;

const layersFollowTheOrder = (layers: readonly Layer[]): boolean => layers.length === LAYER_ORDER.length && layers.every((layer, index) => layer.kind === LAYER_ORDER[index]);

// A Layer leaves `pending` only after the one before it completed (product rule 1); a retry
// resumes at the first unfinished Layer, never from zero.
const layersRunInSequence = (layers: readonly Layer[]): boolean =>
  layers.every((layer, index) => index === 0 || layer.status === "pending" || layers[index - 1]?.status === "completed");

export const JobAnalysisLayersSchema = listOf(LayerSchema)
  .refine(layersFollowTheOrder, { message: "A Job Analysis has the three Layers in their fixed order" })
  .refine(layersRunInSequence, { message: "A Layer starts only after the one before it completed" });

export type JobAnalysisLayers = z.infer<typeof JobAnalysisLayersSchema>;

// Why a start, a cancel, or a retry was refused. Only `job_analysis_active` answers 409, and only
// while a Job Analysis is already queued or running.
export const JobAnalysisActionErrorCodeSchema = z.enum([
  "job_analysis_active",
  "job_analysis_not_found",
  "job_analysis_not_cancellable",
  "job_analysis_not_retryable",
  "job_analysis_curation_replaced",
  "job_analysis_model_changed",
  "job_analysis_unchanged",
  "job_analysis_profile_busy",
]);
export type JobAnalysisActionErrorCode = z.infer<typeof JobAnalysisActionErrorCodeSchema>;

// The code the start route would answer right now, carried with the progress so the page can say
// why before any click: the gate (ADR-0026) and the three things a start needs first.
export const JobAnalysisStartRefusalSchema = z.enum([
  ...JobAnalysisActionErrorCodeSchema.extract(["job_analysis_active", "job_analysis_unchanged", "job_analysis_profile_busy"]).options,
  ...JobDescriptionErrorCodeSchema.extract(["curation_not_completed"]).options,
  ...ModelChoiceErrorCodeSchema.extract(["model_key_missing"]).options,
]);
export type JobAnalysisStartRefusal = z.infer<typeof JobAnalysisStartRefusalSchema>;

export const JobAnalysisReanalysisSchema = z
  .object({
    allowed: z.boolean(),
    refusal: JobAnalysisStartRefusalSchema.nullable(),
  })
  .refine(({ allowed, refusal }) => allowed === (refusal === null), { message: "A re-analysis carries a refusal exactly when it is not allowed", path: ["refusal"] });
export type JobAnalysisReanalysis = z.infer<typeof JobAnalysisReanalysisSchema>;

// The outputs of the completed Layers, each null until its Layer completed and null for a skipped
// Resume Builder; a cancelled Job Analysis keeps the ones it completed.
export const JobAnalysisOutputsSchema = z.object({
  requirementMatch: RequirementMatchResultSchema.nullable(),
  atsScore: AtsScoreSchema.nullable(),
  rebuiltResume: RebuiltResumeSchema.nullable(),
});

export type JobAnalysisOutputs = z.infer<typeof JobAnalysisOutputsSchema>;

const OUTPUT_OF_LAYER: Record<LayerKind, keyof JobAnalysisOutputs> = {
  requirement_match: "requirementMatch",
  ats_score: "atsScore",
  resume_builder: "rebuiltResume",
};

const outputsMatchTheLayers = (layers: readonly Layer[], outputs: JobAnalysisOutputs): boolean =>
  layers.every((layer) => (layer.status === "completed") === (outputs[OUTPUT_OF_LAYER[layer.kind]] !== null));

export const JobAnalysisProgressSchema = z
  .object({
    jobAnalysisId: IdSchema,
    jobDescriptionId: IdSchema,
    status: JobAnalysisStatusSchema,
    layers: JobAnalysisLayersSchema,
    modelId: TextSchema,
    failureReason: JobAnalysisFailureReasonSchema.nullable(),
    failedLayer: LayerKindSchema.nullable(),
    pauseReason: JobAnalysisPauseReasonSchema.nullable(),
    resumeAfter: TimestampSchema.nullable(),
    outputs: JobAnalysisOutputsSchema,
    reanalysis: JobAnalysisReanalysisSchema,
    createdAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
  })
  .refine(({ layers, outputs }) => outputsMatchTheLayers(layers, outputs), { message: "A Layer's output is there exactly when the Layer completed", path: ["outputs"] })
  .refine(({ failureReason, failedLayer }) => failureReason !== null || failedLayer === null, { message: "Only a failed Job Analysis names the Layer that stopped", path: ["failedLayer"] });

export type JobAnalysisProgress = z.infer<typeof JobAnalysisProgressSchema>;

// A Job Description with no Job Analysis yet answers `progress: null`, not a 404: the page renders
// its start gate in that state.
export const JobAnalysisProgressStateSchema = z.object({
  progress: JobAnalysisProgressSchema.nullable(),
});

export type JobAnalysisProgressState = z.infer<typeof JobAnalysisProgressStateSchema>;

// One line of a Job Description's history, newest first; the score is there once it was counted.
export const JobAnalysisSummarySchema = z.object({
  id: IdSchema,
  status: JobAnalysisStatusSchema,
  atsScore: AtsScoreValueSchema.nullable(),
  createdAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
});

export type JobAnalysisSummary = z.infer<typeof JobAnalysisSummarySchema>;

export const JobAnalysisHistorySchema = listOf(JobAnalysisSummarySchema);
export type JobAnalysisHistory = z.infer<typeof JobAnalysisHistorySchema>;

// What the list and the single read answer: the Job Description and where its newest Job
// Analysis stands, or null while none was started.
export const JobDescriptionOverviewSchema = JobDescriptionSchema.extend({
  newestAnalysis: JobAnalysisSummarySchema.nullable(),
});

export type JobDescriptionOverview = z.infer<typeof JobDescriptionOverviewSchema>;

export const JobDescriptionOverviewListSchema = listOf(JobDescriptionOverviewSchema);
export type JobDescriptionOverviewList = z.infer<typeof JobDescriptionOverviewListSchema>;
