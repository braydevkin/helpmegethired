import { z } from "zod";

import { CurationMetricsSchema } from "./curation-metrics.js";
import { IdSchema, TextSchema, TimestampSchema, listOf } from "./primitives.js";

export const CURATION_UNIT_INPUT_MAX_CHARACTERS = 8000;

export const CurationStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled", "superseded"]);
export type CurationStatus = z.infer<typeof CurationStatusSchema>;

// The states that hold the Account's one active Curation; every other state frees it.
export const ACTIVE_CURATION_STATUSES = ["queued", "running"] as const satisfies readonly CurationStatus[];

// Closed lists, so a row or a response never carries a Provider's own message, which can echo
// the input it refused (docs/security.md, "AI pipeline").
export const CurationFailureReasonSchema = z.enum(["attempts_exhausted", "model_key_rejected"]);
export type CurationFailureReason = z.infer<typeof CurationFailureReasonSchema>;

export const CurationUnitFailureReasonSchema = z.enum(["timeout", "invalid_output", "truncated_response", "provider_error"]);
export type CurationUnitFailureReason = z.infer<typeof CurationUnitFailureReasonSchema>;

// Why a cancel, a retry, or a re-run was refused. Only `curation_active` answers 409, and only
// while a Curation is already queued or running.
export const CurationActionErrorCodeSchema = z.enum([
  "curation_active",
  "curation_not_found",
  "curation_not_ready",
  "curation_not_retryable",
  "curation_model_changed",
  "curation_unchanged",
]);
export type CurationActionErrorCode = z.infer<typeof CurationActionErrorCodeSchema>;

export const CurationSchema = z.object({
  id: IdSchema,
  status: CurationStatusSchema,
  attempts: z.int().nonnegative(),
  maxAttempts: z.int().positive(),
  sourceIngestionId: IdSchema,
  createdAt: TimestampSchema,
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  failureReason: CurationFailureReasonSchema.nullable(),
  resumeAfter: TimestampSchema.nullable(),
});

export type Curation = z.infer<typeof CurationSchema>;

export const CurationUnitKindSchema = z.enum(["experience", "project", "cross_cutting", "synthesis"]);
export type CurationUnitKind = z.infer<typeof CurationUnitKindSchema>;

export const CurationUnitStatusSchema = z.enum(["pending", "running", "saved", "failed"]);
export type CurationUnitStatus = z.infer<typeof CurationUnitStatusSchema>;

const CurationUnitFieldsSchema = z.object({
  id: IdSchema,
  kind: CurationUnitKindSchema,
  position: z.int().nonnegative(),
  status: CurationUnitStatusSchema,
  attempts: z.int().nonnegative(),
  failureReason: CurationUnitFailureReasonSchema.nullable(),
  truncated: z.boolean(),
  subjectId: IdSchema.nullable(),
  title: TextSchema,
});

const unitHasSubject = (kind: CurationUnitKind): boolean => kind === "experience" || kind === "project";

// The subject is the Experience or Project the unit reads. The cross-cutting unit reads across
// them and the synthesis unit reads what the others produced, so neither has one.
export const CurationUnitSchema = CurationUnitFieldsSchema.refine((unit) => unitHasSubject(unit.kind) === (unit.subjectId !== null), {
  message: "Only an Experience or Project unit names a subject, and it always does",
  path: ["subjectId"],
});

export type CurationUnit = z.infer<typeof CurationUnitSchema>;

export const CurationUnitSummarySchema = CurationUnitFieldsSchema.pick({
  id: true,
  kind: true,
  title: true,
  status: true,
  failureReason: true,
});

export type CurationUnitSummary = z.infer<typeof CurationUnitSummarySchema>;

// The code `POST /profile/curation/rerun` would answer right now, carried with the progress so the
// page can say why before any click.
export const CurationRerunRefusalSchema = CurationActionErrorCodeSchema.extract(["curation_active", "curation_not_ready", "curation_unchanged"]);
export type CurationRerunRefusal = z.infer<typeof CurationRerunRefusalSchema>;

export const CurationRerunSchema = z
  .object({
    allowed: z.boolean(),
    refusal: CurationRerunRefusalSchema.nullable(),
  })
  .refine(({ allowed, refusal }) => allowed === (refusal === null), { message: "A re-run carries a refusal exactly when it is not allowed", path: ["refusal"] });
export type CurationRerun = z.infer<typeof CurationRerunSchema>;

// Why a queued Curation waits for its resume_after: the Candidate's Provider asked to slow down,
// or the Account used the platform's embedding allowance for the day (#133).
export const CurationPauseReasonSchema = z.enum(["provider_rate_limit", "embedding_ceiling"]);
export type CurationPauseReason = z.infer<typeof CurationPauseReasonSchema>;

// Three units run at once, so the units being read are the listed ones whose status is
// `running`, not one current unit.
export const CurationProgressSchema = z
  .object({
    curationId: IdSchema,
    status: CurationStatusSchema,
    percentage: z.int().min(0).max(100),
    units: z.object({
      total: z.int().nonnegative(),
      saved: z.int().nonnegative(),
      list: listOf(CurationUnitSummarySchema),
    }),
    metrics: CurationMetricsSchema,
    modelId: TextSchema,
    failureReason: CurationFailureReasonSchema.nullable(),
    resumeAfter: TimestampSchema.nullable(),
    pauseReason: CurationPauseReasonSchema.nullable(),
    rerun: CurationRerunSchema,
  })
  .refine(
    ({ units }) => units.total === units.list.length && units.saved === units.list.filter((unit) => unit.status === "saved").length,
    { message: "The counts must match the units listed", path: ["units"] },
  );

export type CurationProgress = z.infer<typeof CurationProgressSchema>;

// An Account with no Curation for its latest Profile answers `progress: null`, not a 404: the
// analysis page renders its gate in that state.
export const CurationProgressStateSchema = z.object({
  progress: CurationProgressSchema.nullable(),
});

export type CurationProgressState = z.infer<typeof CurationProgressStateSchema>;
