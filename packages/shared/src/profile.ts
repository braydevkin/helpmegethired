import { z } from "zod";

import { BasicProfileSchema } from "./basic-profile.js";
import { ExperienceSchema } from "./experience.js";
import { IngestionSourceSchema } from "./ingestion.js";
import { IdSchema, TextSchema, TimestampSchema, listOf } from "./primitives.js";
import { CertificationSchema, EducationSchema, LanguageSchema, SkillSchema } from "./profile-parts.js";
import { ProjectSchema } from "./project.js";

export const ProfilePartSchema = z.enum(["basicProfile", "experience", "education", "project", "skill", "language", "certification"]);
export type ProfilePart = z.infer<typeof ProfilePartSchema>;

export const ReviewReasonSchema = z.enum(["low_confidence", "account_mismatch"]);
export type ReviewReason = z.infer<typeof ReviewReasonSchema>;

// One field the Candidate should look at: named by its part, the entry it belongs to (the
// role, the institution, the project name; none for the Basic Profile), and the field.
export const ReviewFlagSchema = z.object({
  part: ProfilePartSchema,
  entry: TextSchema.nullable(),
  field: TextSchema,
  reason: ReviewReasonSchema,
});

export type ReviewFlag = z.infer<typeof ReviewFlagSchema>;

// The Uploaded Resume the Profile was built from and the Ingestion that wrote its rows.
export const ProfileSourceSchema = z.object({
  kind: IngestionSourceSchema,
  uploadedResumeId: IdSchema.nullable(),
  fileName: TextSchema.nullable(),
  ingestionId: IdSchema,
  completedAt: TimestampSchema,
});

export type ProfileSource = z.infer<typeof ProfileSourceSchema>;

// The seven parts as the latest completed Ingestion wrote them, with the years of experience
// derived on read and the review flags until the Candidate confirms. An Account with no
// completed Ingestion has an empty Profile and no source.
export const ProfileSchema = z.object({
  accountId: IdSchema,
  basicProfile: BasicProfileSchema,
  experiences: listOf(ExperienceSchema),
  education: listOf(EducationSchema),
  projects: listOf(ProjectSchema),
  skills: listOf(SkillSchema),
  languages: listOf(LanguageSchema),
  certifications: listOf(CertificationSchema),
  yearsOfExperience: z.int().nonnegative(),
  reviewFlags: listOf(ReviewFlagSchema),
  source: ProfileSourceSchema.nullable(),
  confirmedAt: TimestampSchema.nullable(),
});

export type Profile = z.infer<typeof ProfileSchema>;
