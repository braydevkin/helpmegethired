import { z } from "zod";

import { IdSchema, TextSchema, TimestampSchema } from "./primitives.js";

const PDF_CONTENT_TYPE = "application/pdf";

const ResumeIdentity = {
  id: IdSchema,
  accountId: IdSchema,
  createdAt: TimestampSchema,
};

export const UploadedResumeSchema = z.object({
  ...ResumeIdentity,
  source: z.literal("upload"),
  fileName: TextSchema,
  contentType: z.literal(PDF_CONTENT_TYPE),
  sizeBytes: z.int().positive(),
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
