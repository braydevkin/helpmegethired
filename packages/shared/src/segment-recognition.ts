import { z } from "zod";

import { TextSchema, listOf } from "./primitives.js";
import { SkillCategorySchema, YearMonthSchema } from "./profile-draft.js";

// What a Model answers for one Segment. Every value carries `quote`, the verbatim span of the
// Segment's text it was read from, so code can discard a value the Segment never held before
// the rules decide its Confidence.
const quoted = <Value extends z.ZodType>(value: Value) => z.object({ value, quote: TextSchema });

export const QuotedTextSchema = quoted(TextSchema);
export type QuotedText = z.infer<typeof QuotedTextSchema>;

export const QuotedUrlSchema = quoted(z.url());

// A period is read from one span such as `Mar 2021 – Present`; an open end means the position is held.
export const QuotedPeriodSchema = z.object({ start: YearMonthSchema, end: YearMonthSchema.nullable(), quote: TextSchema });
export type QuotedPeriod = z.infer<typeof QuotedPeriodSchema>;

export const HeaderRecognitionSchema = z.object({
  headline: QuotedTextSchema.nullable(),
  summary: QuotedTextSchema.nullable(),
  linkedinUrl: QuotedUrlSchema.nullable(),
  githubUrl: QuotedUrlSchema.nullable(),
});

export const ExperienceRecognitionSchema = z.object({
  experiences: listOf(
    z.object({
      role: QuotedTextSchema,
      company: QuotedTextSchema.nullable(),
      period: QuotedPeriodSchema.nullable(),
      description: QuotedTextSchema.nullable(),
      skills: listOf(QuotedTextSchema),
    }),
  ),
});

export const EducationRecognitionSchema = z.object({
  education: listOf(
    z.object({
      institution: QuotedTextSchema,
      degree: QuotedTextSchema.nullable(),
      fieldOfStudy: QuotedTextSchema.nullable(),
      period: QuotedPeriodSchema.nullable(),
    }),
  ),
});

export const ProjectRecognitionSchema = z.object({
  projects: listOf(
    z.object({
      name: QuotedTextSchema,
      description: QuotedTextSchema.nullable(),
      url: QuotedUrlSchema.nullable(),
      skills: listOf(QuotedTextSchema),
    }),
  ),
});

export const SkillsRecognitionSchema = z.object({
  skills: listOf(z.object({ name: QuotedTextSchema, category: SkillCategorySchema })),
});

export const LanguagesRecognitionSchema = z.object({
  languages: listOf(z.object({ name: QuotedTextSchema, level: QuotedTextSchema.nullable() })),
});

export const CertificationsRecognitionSchema = z.object({
  certifications: listOf(
    z.object({
      name: QuotedTextSchema,
      issuer: QuotedTextSchema.nullable(),
      year: quoted(z.int().min(1900).max(2100)).nullable(),
    }),
  ),
});

export const SEGMENT_RECOGNITION_SCHEMAS = {
  header: HeaderRecognitionSchema,
  experience: ExperienceRecognitionSchema,
  education: EducationRecognitionSchema,
  project: ProjectRecognitionSchema,
  skills: SkillsRecognitionSchema,
  languages: LanguagesRecognitionSchema,
  certifications: CertificationsRecognitionSchema,
} as const;

export type SegmentRecognitionKind = keyof typeof SEGMENT_RECOGNITION_SCHEMAS;

export type SegmentRecognition<Kind extends SegmentRecognitionKind> = z.infer<(typeof SEGMENT_RECOGNITION_SCHEMAS)[Kind]>;
