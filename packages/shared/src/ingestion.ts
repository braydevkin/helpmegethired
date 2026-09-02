import { z } from "zod";

import { IdSchema, TimestampSchema } from "./primitives.js";

export const IngestionStatusSchema = z.enum(["queued", "running", "failed", "completed"]);
export type IngestionStatus = z.infer<typeof IngestionStatusSchema>;

export const SegmentStepSchema = z.enum(["read", "recognize", "save"]);
export type SegmentStep = z.infer<typeof SegmentStepSchema>;

export const SegmentStatusSchema = z.enum(["pending", "read", "recognized", "saved"]);
export type SegmentStatus = z.infer<typeof SegmentStatusSchema>;

export const IngestionSchema = z.object({
  id: IdSchema,
  accountId: IdSchema,
  status: IngestionStatusSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  lastError: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type Ingestion = z.infer<typeof IngestionSchema>;

export const IngestionProgressSchema = z.object({
  ingestionId: IdSchema,
  status: IngestionStatusSchema,
  percentage: z.number().int().min(0).max(100),
  segments: z.object({
    total: z.number().int().nonnegative(),
    saved: z.number().int().nonnegative(),
  }),
});

export type IngestionProgress = z.infer<typeof IngestionProgressSchema>;
