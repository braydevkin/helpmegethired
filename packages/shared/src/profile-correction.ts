import { z } from "zod";

import { ExperienceSchema } from "./experience.js";
import { IdSchema, listOf } from "./primitives.js";
import type { Period } from "./profile-draft.js";
import { CertificationSchema, EducationSchema, LanguageSchema, SkillSchema } from "./profile-parts.js";
import { ProjectSchema } from "./project.js";

// The Profile parts that hold a list of entries, named as the Profile answers them.
export const ProfileListPartSchema = z.enum(["experiences", "education", "projects", "skills", "languages", "certifications"]);
export type ProfileListPart = z.infer<typeof ProfileListPartSchema>;

// A résumé is kept as it was written, reversed dates included, so only a period the Candidate
// writes by hand has to end after it starts. Months as YYYY-MM compare as text.
const endsAfterItStarts = ({ period }: { period: Period | null }): boolean => period?.end == null || period.end >= period.start;

const PERIOD_ORDER = { path: ["period", "end"], message: "The month it ended comes before the month it started." };

// A correction carries the entry without its id: the path names it for a replacement, and a
// new entry is given one when it is written.
export const ExperienceCorrectionSchema = ExperienceSchema.omit({ id: true }).refine(endsAfterItStarts, PERIOD_ORDER);
export type ExperienceCorrection = z.infer<typeof ExperienceCorrectionSchema>;

export const EducationCorrectionSchema = EducationSchema.omit({ id: true }).refine(endsAfterItStarts, PERIOD_ORDER);
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
