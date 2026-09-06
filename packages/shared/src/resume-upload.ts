import { z } from "zod";

import { TextSchema } from "./primitives.js";

const MEGABYTE = 1024 * 1024;

export const RESUME_MAX_SIZE_BYTES = 5 * MEGABYTE;
export const RESUME_MAX_PAGES = 20;
export const PDF_CONTENT_TYPE = "application/pdf";

const PDF_FILE_NAME = /\.pdf$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export const ResumeUploadErrorCodeSchema = z.enum([
  "not_pdf",
  "too_large",
  "too_many_pages",
  "encrypted_pdf",
  "corrupt_pdf",
  "scanned_pdf",
  "upload_incomplete",
  "extraction_failed",
  "profile_build_failed",
  "ingestion_active",
]);

export type ResumeUploadErrorCode = z.infer<typeof ResumeUploadErrorCodeSchema>;

export const Sha256Schema = z.string().regex(SHA256_HEX);

export const ResumeUploadSchema = z.object({
  fileName: TextSchema.max(255).regex(PDF_FILE_NAME),
  sizeBytes: z.int().positive().max(RESUME_MAX_SIZE_BYTES),
  sha256: Sha256Schema,
});

export type ResumeUpload = z.infer<typeof ResumeUploadSchema>;
