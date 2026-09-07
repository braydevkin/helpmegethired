import { z } from "zod";

import { TimestampSchema } from "./primitives.js";
import { UploadedResumeSchema, UploadedResumeStatusSchema } from "./resume.js";

export const PresignedUploadSchema = z.object({
  url: z.url(),
  method: z.literal("PUT"),
  headers: z.record(z.string(), z.string()),
  expiresAt: TimestampSchema,
});

export type PresignedUpload = z.infer<typeof PresignedUploadSchema>;

// POST /resumes: the record, and the upload to perform while the record is still pending.
export const ResumeUploadReceiptSchema = z.object({
  resume: UploadedResumeSchema,
  upload: PresignedUploadSchema.nullable(),
});

export type ResumeUploadReceipt = z.infer<typeof ResumeUploadReceiptSchema>;

// GET /resumes
export const UploadedResumeListQuerySchema = z.object({
  status: UploadedResumeStatusSchema.optional(),
});

export type UploadedResumeListQuery = z.infer<typeof UploadedResumeListQuerySchema>;

export const UploadedResumeListSchema = z.array(UploadedResumeSchema);

export type UploadedResumeList = z.infer<typeof UploadedResumeListSchema>;
