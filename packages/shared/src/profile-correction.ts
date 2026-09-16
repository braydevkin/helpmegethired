import { z } from "zod";

import { ExperienceSchema } from "./experience.js";
import { IdSchema, listOf } from "./primitives.js";
import { CertificationSchema, EducationSchema, LanguageSchema, SkillSchema } from "./profile-parts.js";
import { ProjectSchema } from "./project.js";

// The Profile parts that hold a list of entries, named as the Profile answers them.
export const ProfileListPartSchema = z.enum(["experiences", "education", "projects", "skills", "languages", "certifications"]);
export type ProfileListPart = z.infer<typeof ProfileListPartSchema>;

// A correction carries the entry without its id: the path names it for a replacement, and a
// new entry is given one when it is written.
export const ExperienceCorrectionSchema = ExperienceSchema.omit({ id: true });
export type ExperienceCorrection = z.infer<typeof ExperienceCorrectionSchema>;

export const EducationCorrectionSchema = EducationSchema.omit({ id: true });
export type EducationCorrection = z.infer<typeof EducationCorrectionSchema>;

export const ProjectCorrectionSchema = ProjectSchema.omit({ id: true });
export type ProjectCorrection = z.infer<typeof ProjectCorrectionSchema>;

export const SkillCorrectionSchema = SkillSchema.omit({ id: true });
export type SkillCorrection = z.infer<typeof SkillCorrectionSchema>;

export const LanguageCorrectionSchema = LanguageSchema.omit({ id: true });
export type LanguageCorrection = z.infer<typeof LanguageCorrectionSchema>;

export const CertificationCorrectionSchema = CertificationSchema.omit({ id: true });
export type CertificationCorrection = z.infer<typeof CertificationCorrectionSchema>;

export const PROFILE_ENTRY_CORRECTION_SCHEMAS = {
  experiences: ExperienceCorrectionSchema,
  education: EducationCorrectionSchema,
  projects: ProjectCorrectionSchema,
  skills: SkillCorrectionSchema,
  languages: LanguageCorrectionSchema,
  certifications: CertificationCorrectionSchema,
} as const satisfies Record<ProfileListPart, z.ZodType>;

export type ProfileEntryCorrection = z.infer<(typeof PROFILE_ENTRY_CORRECTION_SCHEMAS)[ProfileListPart]>;

// What the Candidate corrected by hand on the Profile the Ingestion recognized: the entries
// they touched, and whether the Basic Profile is one of them.
export const ProfileCorrectionsSchema = z.object({
  basicProfile: z.boolean(),
  entryIds: listOf(IdSchema),
});

export type ProfileCorrections = z.infer<typeof ProfileCorrectionsSchema>;
