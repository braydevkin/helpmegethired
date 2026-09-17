import { z } from "zod";

import { CURATION_UNIT_INPUT_MAX_CHARACTERS } from "./curation.js";
import { IdSchema, TextSchema, listOf } from "./primitives.js";
import { EvidenceKindSchema } from "./statement.js";

// A citation names the text it quotes and the quote, never offsets: the runner finds the quote in
// that text to build the Evidence (#113), so a model cannot claim a span that is not there.
export const EvidenceCitationSchema = z.object({
  kind: EvidenceKindSchema,
  referenceId: IdSchema,
  quote: z.string().min(1).max(CURATION_UNIT_INPUT_MAX_CHARACTERS),
});

export type EvidenceCitation = z.infer<typeof EvidenceCitationSchema>;

export const StatementDraftSchema = z.object({
  text: TextSchema,
  labels: listOf(TextSchema),
  evidence: listOf(EvidenceCitationSchema).min(1),
});

export type StatementDraft = z.infer<typeof StatementDraftSchema>;

// What a model answers for one Curation Unit; an answer that does not validate is a failed call
// (docs/security.md, "AI pipeline").
export const CurationUnitOutputSchema = z.object({
  statements: listOf(StatementDraftSchema),
});

export type CurationUnitOutput = z.infer<typeof CurationUnitOutputSchema>;
