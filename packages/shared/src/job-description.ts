import { z } from "zod";

import { IdSchema, TimestampSchema } from "./primitives.js";

// A Job Description reaches the Model whole, inside its delimiters, so the paste is capped where
// a long posting still fits and a scraped careers page does not.
export const JOB_DESCRIPTION_MAX_CHARACTERS = 20_000;

export const JobDescriptionTextSchema = z.string().trim().min(1).max(JOB_DESCRIPTION_MAX_CHARACTERS);

export const JobDescriptionPasteSchema = z.object({
  text: JobDescriptionTextSchema,
});

export type JobDescriptionPaste = z.infer<typeof JobDescriptionPasteSchema>;

// Kept as pasted and never edited; the same text pasted again by the same Account is this one.
export const JobDescriptionSchema = z.object({
  id: IdSchema,
  text: JobDescriptionTextSchema,
  createdAt: TimestampSchema,
});

export type JobDescription = z.infer<typeof JobDescriptionSchema>;

// A paste is refused while the Account has nothing a Job Analysis could read (ADR-0024).
export const JobDescriptionErrorCodeSchema = z.enum(["job_description_not_found", "curation_not_completed"]);
export type JobDescriptionErrorCode = z.infer<typeof JobDescriptionErrorCodeSchema>;
