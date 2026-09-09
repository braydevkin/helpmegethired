import { z } from "zod";

import { IdSchema, TextSchema, TimestampSchema, listOf } from "./primitives.js";

// Where an Ingestion's Segments come from; a completed Ingestion replaces the earlier ones of
// its source and never touches what another source wrote.
export const IngestionSourceSchema = z.enum(["upload", "linkedin"]);
export type IngestionSource = z.infer<typeof IngestionSourceSchema>;

export const IngestionStatusSchema = z.enum(["queued", "running", "failed", "completed"]);
export type IngestionStatus = z.infer<typeof IngestionStatusSchema>;

export const SegmentStepSchema = z.enum(["read", "recognize", "save"]);
export type SegmentStep = z.infer<typeof SegmentStepSchema>;

export const SegmentStatusSchema = z.enum(["pending", "read", "recognized", "saved"]);
export type SegmentStatus = z.infer<typeof SegmentStatusSchema>;

export const IngestionSchema = z.object({
  id: IdSchema,
  accountId: IdSchema,
  source: IngestionSourceSchema,
  status: IngestionStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  lastError: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
});

export type Ingestion = z.infer<typeof IngestionSchema>;

export const IngestionProgressSchema = z.object({
  ingestionId: IdSchema,
  status: IngestionStatusSchema,
  percentage: z.number().int().min(0).max(100),
  // The kind of every saved Segment, in position order, so a page can tick the Profile parts
  // as they are written.
  segments: z.object({
    total: z.number().int().nonnegative(),
    saved: z.number().int().nonnegative(),
    savedKinds: listOf(TextSchema),
  }),
});

export type IngestionProgress = z.infer<typeof IngestionProgressSchema>;
