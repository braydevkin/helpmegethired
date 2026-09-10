import { z } from "zod";

import { TextSchema, listOf } from "./primitives.js";

export const DurationSchema = z.object({
  years: z.int().nonnegative(),
  months: z.int().min(0).max(11),
});

export type Duration = z.infer<typeof DurationSchema>;

export const CompanyDurationSchema = z.object({
  company: TextSchema,
  duration: DurationSchema,
});

export type CompanyDuration = z.infer<typeof CompanyDurationSchema>;

export const ProfileCountsSchema = z.object({
  roles: z.int().nonnegative(),
  projects: z.int().nonnegative(),
  certifications: z.int().nonnegative(),
  languages: z.int().nonnegative(),
  education: z.int().nonnegative(),
});

export type ProfileCounts = z.infer<typeof ProfileCountsSchema>;

// Counted from the structured Profile, never by a model: every prompt receives these as facts,
// and the analysis page shows the same values, so the Candidate never sees a number the model
// was not given.
export const CurationMetricsSchema = z.object({
  careerDuration: DurationSchema,
  durationPerCompany: listOf(CompanyDurationSchema),
  counts: ProfileCountsSchema,
});

export type CurationMetrics = z.infer<typeof CurationMetricsSchema>;
