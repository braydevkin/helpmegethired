import { z } from "zod";

import { TextSchema } from "./primitives.js";

// How sure the recognition is about one field; low is what the Profile page flags for review.
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const fieldOf = <Value extends z.ZodType>(value: Value) =>
  z.object({ value, confidence: ConfidenceSchema });

export interface Field<Value> {
  value: Value;
  confidence: Confidence;
}

const TextField = fieldOf(TextSchema);
const UrlField = fieldOf(z.url());

// A month-precise period: the day is never on a resume. An open end means the position is held.
export const YearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export type YearMonth = z.infer<typeof YearMonthSchema>;

export const PeriodSchema = z.object({ start: YearMonthSchema, end: YearMonthSchema.nullable() });
export type Period = z.infer<typeof PeriodSchema>;

export const SkillCategorySchema = z.enum(["Languages & runtimes", "Frameworks & data", "Infrastructure", "Other"]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const DraftBasicProfileSchema = z.object({
  headline: TextField.nullable(),
  summary: TextField.nullable(),
  linkedinUrl: UrlField.nullable(),
  githubUrl: UrlField.nullable(),
});

export const DraftExperienceSchema = z.object({
  company: TextField,
  role: TextField,
  period: fieldOf(PeriodSchema).nullable(),
  description: TextField.nullable(),
  skills: z.array(TextSchema),
});

export const DraftEducationSchema = z.object({
  institution: TextField,
  degree: TextField.nullable(),
  fieldOfStudy: TextField.nullable(),
  period: fieldOf(PeriodSchema).nullable(),
});

export const DraftProjectSchema = z.object({
  name: TextField,
  description: TextField.nullable(),
  url: UrlField.nullable(),
  skills: z.array(TextSchema),
});

export const DraftSkillSchema = z.object({
  name: TextSchema,
  category: SkillCategorySchema,
  confidence: ConfidenceSchema,
});

export const DraftLanguageSchema = z.object({
  name: TextField,
  level: TextField.nullable(),
});

export const DraftCertificationSchema = z.object({
  name: TextField,
  issuer: TextField.nullable(),
  year: fieldOf(z.int().min(1900).max(2100)).nullable(),
});

// What the parser recognises from the stored text: the seven Profile parts, every field with
// its Confidence, and the version of the rules that produced it.
export const ProfileDraftSchema = z.object({
  parserVersion: TextSchema,
  basicProfile: DraftBasicProfileSchema,
  experiences: z.array(DraftExperienceSchema),
  education: z.array(DraftEducationSchema),
  projects: z.array(DraftProjectSchema),
  skills: z.array(DraftSkillSchema),
  languages: z.array(DraftLanguageSchema),
  certifications: z.array(DraftCertificationSchema),
});

export type DraftBasicProfile = z.infer<typeof DraftBasicProfileSchema>;
export type DraftExperience = z.infer<typeof DraftExperienceSchema>;
export type DraftEducation = z.infer<typeof DraftEducationSchema>;
export type DraftProject = z.infer<typeof DraftProjectSchema>;
export type DraftSkill = z.infer<typeof DraftSkillSchema>;
export type DraftLanguage = z.infer<typeof DraftLanguageSchema>;
export type DraftCertification = z.infer<typeof DraftCertificationSchema>;
export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;
