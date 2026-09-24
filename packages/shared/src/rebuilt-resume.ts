import { z } from "zod";

import { TextSchema, listOf } from "./primitives.js";
import { CitedSourceSchema, CitedSourcesSchema, citedSourcesResolve } from "./requirement-match.js";

// Every sentence rests on a Statement or a Fact it names; one that cites nothing is dropped by
// code and counted, never shown (ADR-0026, "Resume Builder").
export const RebuiltSentenceSchema = z.object({
  text: TextSchema,
  sources: listOf(CitedSourceSchema).min(1),
});

export type RebuiltSentence = z.infer<typeof RebuiltSentenceSchema>;

export const RebuiltSectionKindSchema = z.enum(["summary", "experience", "project", "skills", "education", "certifications", "languages"]);
export type RebuiltSectionKind = z.infer<typeof RebuiltSectionKindSchema>;

export const RebuiltSectionSchema = z.object({
  kind: RebuiltSectionKindSchema,
  title: TextSchema,
  sentences: listOf(RebuiltSentenceSchema).min(1),
});

export type RebuiltSection = z.infer<typeof RebuiltSectionSchema>;

// What the Model answers. The header is not here: name, email, and phone never reach the Model
// and come from the Account Information when the Rebuilt Resume is shown.
export const RebuiltResumeOutputSchema = z.object({
  sections: listOf(RebuiltSectionSchema).min(1),
});

export type RebuiltResumeOutput = z.infer<typeof RebuiltResumeOutputSchema>;

const sentencesOf = (sections: readonly RebuiltSection[]): RebuiltSentence[] => sections.flatMap((section) => section.sentences);

// What the Resume Builder Layer persists: the sections whose sentences all resolved, the copies
// they cite, and how many sentences were dropped for citing nothing it was given.
export const RebuiltResumeContentSchema = CitedSourcesSchema.extend({
  sections: listOf(RebuiltSectionSchema).min(1),
  droppedSentences: z.int().nonnegative(),
}).refine(
  (content) =>
    citedSourcesResolve(
      sentencesOf(content.sections).flatMap((sentence) => sentence.sources),
      content,
    ),
  { message: "Every sentence cites a copy the Job Analysis keeps", path: ["sections"] },
);

export type RebuiltResumeContent = z.infer<typeof RebuiltResumeContentSchema>;
