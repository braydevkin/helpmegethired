import { z } from "zod";

import { CURATION_UNIT_INPUT_MAX_CHARACTERS, CurationUnitKindSchema } from "./curation.js";
import { IdSchema, TextSchema, TimestampSchema, listOf } from "./primitives.js";

export const EvidenceKindSchema = z.enum(["experience", "project", "text_span"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

// The quote is the exact slice [start, end) of the referenced text: the description of the
// Experience or Project, or the extracted text of the Uploaded Resume for a text span. That is
// what lets the runner resolve it before saving a Statement, and refuse one it cannot resolve.
export const EvidenceSchema = z
  .object({
    kind: EvidenceKindSchema,
    referenceId: IdSchema,
    quote: z.string().min(1).max(CURATION_UNIT_INPUT_MAX_CHARACTERS),
    start: z.int().nonnegative(),
    end: z.int().positive(),
  })
  .refine(({ start, end, quote }) => end - start === quote.length, {
    message: "The offsets must span exactly the quoted text",
    path: ["end"],
  });

export type Evidence = z.infer<typeof EvidenceSchema>;

export const StatementReviewStateSchema = z.enum(["accepted", "rejected", "unreviewed"]);
export type StatementReviewState = z.infer<typeof StatementReviewStateSchema>;

export const StatementReviewSchema = z
  .object({
    state: StatementReviewStateSchema,
    reviewedAt: TimestampSchema.nullable(),
  })
  .refine(({ state, reviewedAt }) => (state === "unreviewed") === (reviewedAt === null), {
    message: "A reviewed Statement records when, and an unreviewed one has no time",
    path: ["reviewedAt"],
  });

export type StatementReview = z.infer<typeof StatementReviewSchema>;

// The model id is kept as written rather than checked against today's catalogue, because a
// Statement must stay readable after the model that wrote it is retired.
export const StatementSchema = z.object({
  id: IdSchema,
  text: TextSchema,
  labels: listOf(TextSchema),
  evidence: listOf(EvidenceSchema).min(1),
  promptVersion: TextSchema,
  modelId: TextSchema,
  review: StatementReviewSchema,
  createdAt: TimestampSchema,
});

export type Statement = z.infer<typeof StatementSchema>;

// Where the Candidate reads a Statement came from: the unit that wrote it, which is one
// Experience or Project, or the cross-cutting or synthesis reading of the whole Profile.
export const StatementSourceSchema = z.object({
  unitKind: CurationUnitKindSchema,
  title: TextSchema,
});

export type StatementSource = z.infer<typeof StatementSourceSchema>;

export const CuratedStatementSchema = StatementSchema.extend({
  source: StatementSourceSchema,
});

export type CuratedStatement = z.infer<typeof CuratedStatementSchema>;

export const CurationStatementsSchema = z
  .object({
    curationId: IdSchema.nullable(),
    statements: listOf(CuratedStatementSchema),
  })
  .refine(({ curationId, statements }) => curationId !== null || statements.length === 0, {
    message: "Only a Curation has Statements",
    path: ["statements"],
  })
  .describe(
    "The Statements of the current Curation, the latest completed one, which is what retrieval reads; `curationId: null` with no Statements until one completes. A review belongs to its Statement and is not carried to the Statements of a re-run, which have no stable identity to inherit it from.",
  );

export type CurationStatements = z.infer<typeof CurationStatementsSchema>;

export const StatementReviewRequestSchema = z.object({
  state: StatementReviewStateSchema,
});

export type StatementReviewRequest = z.infer<typeof StatementReviewRequestSchema>;
