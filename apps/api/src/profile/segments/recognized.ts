import { z } from "zod";
import {
  DraftBasicProfileSchema,
  DraftCertificationSchema,
  DraftEducationSchema,
  DraftExperienceSchema,
  DraftLanguageSchema,
  DraftProjectSchema,
  DraftSkillSchema,
} from "@helpmegethired/shared";

// The output of each kind's recognize Step, as it is stored on the Segment and read back for
// the review flags: every field with its Confidence.
export const RecognizedHeaderSchema = z.object({
  basicProfile: DraftBasicProfileSchema,
  accountMismatch: z.object({ name: z.boolean(), email: z.boolean() }),
});

export const RecognizedExperienceSchema = z.object({ experiences: z.array(DraftExperienceSchema) });
export const RecognizedEducationSchema = z.object({ education: z.array(DraftEducationSchema) });
export const RecognizedProjectSchema = z.object({ projects: z.array(DraftProjectSchema) });
export const RecognizedSkillsSchema = z.object({ skills: z.array(DraftSkillSchema) });
export const RecognizedLanguagesSchema = z.object({ languages: z.array(DraftLanguageSchema) });
export const RecognizedCertificationsSchema = z.object({ certifications: z.array(DraftCertificationSchema) });

export type RecognizedHeader = z.infer<typeof RecognizedHeaderSchema>;
export type RecognizedExperience = z.infer<typeof RecognizedExperienceSchema>;
export type RecognizedEducation = z.infer<typeof RecognizedEducationSchema>;
export type RecognizedProject = z.infer<typeof RecognizedProjectSchema>;
export type RecognizedSkills = z.infer<typeof RecognizedSkillsSchema>;
export type RecognizedLanguages = z.infer<typeof RecognizedLanguagesSchema>;
export type RecognizedCertifications = z.infer<typeof RecognizedCertificationsSchema>;

export const RecognizedByKindSchema = {
  header: RecognizedHeaderSchema,
  experience: RecognizedExperienceSchema,
  education: RecognizedEducationSchema,
  project: RecognizedProjectSchema,
  skills: RecognizedSkillsSchema,
  languages: RecognizedLanguagesSchema,
  certifications: RecognizedCertificationsSchema,
} as const;
