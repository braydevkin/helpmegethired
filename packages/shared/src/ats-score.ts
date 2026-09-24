import { z } from "zod";

import { IdSchema, TextSchema, listOf } from "./primitives.js";
import { RequirementKindSchema } from "./requirement-match.js";

// The Resume Builder runs below this score and is skipped at it or above (product rule 6).
export const ATS_SCORE_REBUILD_THRESHOLD = 8;

// A whole number from 0 to 10, and nothing else validates (docs/security.md, "Output").
export const AtsScoreValueSchema = z.int().min(0).max(10);
export type AtsScoreValue = z.infer<typeof AtsScoreValueSchema>;

// One line of the breakdown: what the Requirement weighed and whether the Strengths covered it,
// so every lost point names the Requirement behind it.
export const AtsScoreBreakdownEntrySchema = z.object({
  requirementId: IdSchema,
  kind: RequirementKindSchema,
  weight: z.int().positive(),
  strength: z.boolean(),
});

export type AtsScoreBreakdownEntry = z.infer<typeof AtsScoreBreakdownEntrySchema>;

// Calculated by a versioned rule set with no Model call; the version is kept with the score so a
// change of rules is visible and reopens the re-analysis gate.
export const AtsScoreSchema = z
  .object({
    score: AtsScoreValueSchema,
    ruleSetVersion: TextSchema,
    breakdown: listOf(AtsScoreBreakdownEntrySchema).min(1),
  })
  .refine(({ breakdown }) => new Set(breakdown.map((entry) => entry.requirementId)).size === breakdown.length, {
    message: "The breakdown lists each Requirement once",
    path: ["breakdown"],
  });

export type AtsScore = z.infer<typeof AtsScoreSchema>;

export const needsRebuild = (score: AtsScoreValue): boolean => score < ATS_SCORE_REBUILD_THRESHOLD;
