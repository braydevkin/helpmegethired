import { z } from "zod";

import { IdSchema, TextSchema } from "./primitives.js";
import { PeriodSchema, SkillCategorySchema } from "./profile-draft.js";

export const EducationSchema = z.object({
  id: IdSchema,
  institution: TextSchema,
  degree: TextSchema.nullable(),
  fieldOfStudy: TextSchema.nullable(),
  period: PeriodSchema.nullable(),
});

export type Education = z.infer<typeof EducationSchema>;

export const SkillSchema = z.object({
  id: IdSchema,
  name: TextSchema,
  category: SkillCategorySchema,
});

export type Skill = z.infer<typeof SkillSchema>;

export const LanguageSchema = z.object({
  id: IdSchema,
  name: TextSchema,
  level: TextSchema.nullable(),
});

export type Language = z.infer<typeof LanguageSchema>;

export const CertificationSchema = z.object({
  id: IdSchema,
  name: TextSchema,
  issuer: TextSchema.nullable(),
  year: z.int().min(1900).max(2100).nullable(),
});

export type Certification = z.infer<typeof CertificationSchema>;
