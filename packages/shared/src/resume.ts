import { z } from "zod";

import { IngestionProgressSchema } from "./ingestion.js";
import { IdSchema, TextSchema, TimestampSchema } from "./primitives.js";
import { PDF_CONTENT_TYPE, ResumeUploadErrorCodeSchema, Sha256Schema } from "./resume-upload.js";

const ResumeIdentity = {
  id: IdSchema,
  accountId: IdSchema,
  createdAt: TimestampSchema,
};

export const UploadedResumeStatusSchema = z.enum(["pending", "uploaded", "processing", "done", "failed", "expired"]);
export type UploadedResumeStatus = z.infer<typeof UploadedResumeStatusSchema>;

export const UploadedResumeSchema = z.object({
  ...ResumeIdentity,
  source: z.literal("upload"),
  fileName: TextSchema,
  contentType: z.literal(PDF_CONTENT_TYPE),
  sizeBytes: z.int().positive(),
  sha256: Sha256Schema,
  status: UploadedResumeStatusSchema,
  errorCode: ResumeUploadErrorCodeSchema.nullable(),
  finishedAt: TimestampSchema.nullable(),
  progress: IngestionProgressSchema.nullable(),
});

export const RebuiltResumeSchema = z.object({
  ...ResumeIdentity,
  source: z.literal("rebuild"),
  jobDescriptionId: IdSchema,
  content: TextSchema,
});

export const ResumeSchema = z.discriminatedUnion("source", [
  UploadedResumeSchema,
  RebuiltResumeSchema,
]);

export type UploadedResume = z.infer<typeof UploadedResumeSchema>;
export type RebuiltResume = z.infer<typeof RebuiltResumeSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type ResumeSource = Resume["source"];
