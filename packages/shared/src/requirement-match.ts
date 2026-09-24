import { z } from "zod";

import { FactSchema } from "./fact.js";
import { JOB_DESCRIPTION_MAX_CHARACTERS } from "./job-description.js";
import { IdSchema, TextSchema, listOf } from "./primitives.js";

export const RequirementKindSchema = z.enum(["required", "preferred"]);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

// The quote is the words of the Job Description that ask for it; a Requirement whose quote does
// not stand in the Job Description does not exist (CONTEXT.md), and code drops it.
export const RequirementDraftSchema = z.object({
  kind: RequirementKindSchema,
  text: TextSchema,
  quote: z.string().min(1).max(JOB_DESCRIPTION_MAX_CHARACTERS),
});

export type RequirementDraft = z.infer<typeof RequirementDraftSchema>;

// The Model's first answer, reading the Job Description; an answer that does not validate is a
// failed call (docs/security.md, "Output"). An empty list validates: it fails the Job Analysis by
// rule, not by schema.
export const RequirementsOutputSchema = z.object({
  requirements: listOf(RequirementDraftSchema),
});

export type RequirementsOutput = z.infer<typeof RequirementsOutputSchema>;

export const RequirementSchema = RequirementDraftSchema.extend({
  id: IdSchema,
});

export type Requirement = z.infer<typeof RequirementSchema>;

const CitedSourceFieldsSchema = z.object({
  statementId: IdSchema.nullable(),
  factId: IdSchema.nullable(),
});

const citesExactlyOne = ({ statementId, factId }: z.infer<typeof CitedSourceFieldsSchema>): boolean => (statementId === null) !== (factId === null);

const EXACTLY_ONE_SOURCE = { message: "A citation names one Statement or one Fact, never neither and never both", path: ["factId"] };

// What a Match or a rebuilt sentence rests on: one Statement or one Fact the Model was given.
export const CitedSourceSchema = CitedSourceFieldsSchema.refine(citesExactlyOne, EXACTLY_ONE_SOURCE);

export type CitedSource = z.infer<typeof CitedSourceSchema>;

const MatchFieldsSchema = CitedSourceFieldsSchema.extend({
  requirementId: IdSchema,
  reason: TextSchema,
});

// The Model's second answer, one Match per supported Requirement, each citing one Statement or
// Fact it was given. A Match carries no number.
export const MatchDraftSchema = MatchFieldsSchema.refine(citesExactlyOne, EXACTLY_ONE_SOURCE);

export type MatchDraft = z.infer<typeof MatchDraftSchema>;

export const MatchesOutputSchema = z.object({
  matches: listOf(MatchDraftSchema),
});

export type MatchesOutput = z.infer<typeof MatchesOutputSchema>;

export const MatchSchema = MatchFieldsSchema.extend({ id: IdSchema }).refine(citesExactlyOne, EXACTLY_ONE_SOURCE);

export type Match = z.infer<typeof MatchSchema>;

// The copy a Job Analysis keeps of a Statement it cited, so it still reads after the Curation that
// wrote the Statement is replaced (ADR-0026, "History").
export const CitedStatementSchema = z.object({
  id: IdSchema,
  text: TextSchema,
  evidenceQuotes: listOf(TextSchema).min(1),
});

export type CitedStatement = z.infer<typeof CitedStatementSchema>;

export const CitedSourcesSchema = z.object({
  citedStatements: listOf(CitedStatementSchema),
  citedFacts: listOf(FactSchema),
});

export type CitedSources = z.infer<typeof CitedSourcesSchema>;

export const citedSourcesResolve = (sources: readonly CitedSource[], copies: CitedSources): boolean => {
  const statementIds = new Set(copies.citedStatements.map((statement) => statement.id));
  const factIds = new Set(copies.citedFacts.map((fact) => fact.id));

  return sources.every(({ statementId, factId }) => (statementId === null || statementIds.has(statementId)) && (factId === null || factIds.has(factId)));
};

const CITATIONS_RESOLVE = { message: "Every citation resolves to a copy the Job Analysis keeps", path: ["citedStatements"] };

// What the Requirement Match Layer persists. A Requirement with a Match is a Strength and one
// without is a Weakness, so neither is stored.
export const RequirementMatchResultSchema = CitedSourcesSchema.extend({
  requirements: listOf(RequirementSchema).min(1),
  matches: listOf(MatchSchema),
})
  .refine(
    ({ requirements, matches }) => {
      const requirementIds = new Set(requirements.map((requirement) => requirement.id));
      return matches.every((match) => requirementIds.has(match.requirementId));
    },
    { message: "Every Match names a Requirement of this Job Analysis", path: ["matches"] },
  )
  .refine((result) => citedSourcesResolve(result.matches, result), CITATIONS_RESOLVE);

export type RequirementMatchResult = z.infer<typeof RequirementMatchResultSchema>;
