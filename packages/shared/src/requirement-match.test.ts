import { describe, expect, it } from "vitest";

import { FACT_ID, REQUIREMENT_ID, STATEMENT_ID, citedStatement, educationFact, requirement } from "./candidate.fixtures.js";
import {
  CitedSourceSchema,
  MatchSchema,
  MatchesOutputSchema,
  RequirementMatchResultSchema,
  RequirementsOutputSchema,
} from "./requirement-match.js";

const MATCH_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const OTHER_ID = "3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a";

const requirementDraft = { kind: "preferred", text: "A degree in computer science", quote: "a degree in computer science or similar" };
const matchDraft = { requirementId: REQUIREMENT_ID, statementId: STATEMENT_ID, factId: null, reason: "The Statement describes running the platform." };
const match = { ...matchDraft, id: MATCH_ID };
const result = { requirements: [requirement], matches: [match], citedStatements: [citedStatement], citedFacts: [] };

describe("RequirementsOutputSchema", () => {
  it("accepts Requirements that each quote the Job Description", () => {
    expect(RequirementsOutputSchema.safeParse({ requirements: [requirementDraft] }).success).toBe(true);
  });

  it("accepts a Job Description the Model found no Requirement in, which the rules fail", () => {
    expect(RequirementsOutputSchema.safeParse({ requirements: [] }).success).toBe(true);
  });

  it.each([
    ["a Requirement without a quote", { requirements: [{ kind: "required", text: "Five years of experience" }] }],
    ["a Requirement with an empty quote", { requirements: [{ ...requirementDraft, quote: "" }] }],
    ["a Requirement of an unknown kind", { requirements: [{ ...requirementDraft, kind: "nice_to_have" }] }],
    ["a Requirement with no text", { requirements: [{ ...requirementDraft, text: "" }] }],
    ["plain text instead of JSON", "Five years of experience"],
  ])("rejects %s", (_label, input) => {
    expect(RequirementsOutputSchema.safeParse(input).success).toBe(false);
  });
});

describe("CitedSourceSchema", () => {
  it.each([
    ["a Statement", { statementId: STATEMENT_ID, factId: null }],
    ["a Fact", { statementId: null, factId: FACT_ID }],
  ])("accepts a citation of %s", (_label, input) => {
    expect(CitedSourceSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["neither a Statement nor a Fact", { statementId: null, factId: null }],
    ["both a Statement and a Fact", { statementId: STATEMENT_ID, factId: FACT_ID }],
    ["a Statement by name instead of id", { statementId: "the first Statement", factId: null }],
  ])("rejects a citation of %s", (_label, input) => {
    expect(CitedSourceSchema.safeParse(input).success).toBe(false);
  });
});

describe("MatchesOutputSchema", () => {
  it("accepts Matches that each cite one Statement or Fact with a reason", () => {
    expect(MatchesOutputSchema.safeParse({ matches: [matchDraft, { ...matchDraft, statementId: null, factId: FACT_ID }] }).success).toBe(true);
  });

  it("accepts no Match at all, which makes every Requirement a Weakness", () => {
    expect(MatchesOutputSchema.safeParse({ matches: [] }).success).toBe(true);
  });

  it("drops a number the Model attached to a Match, which carries none", () => {
    const parsed = MatchesOutputSchema.parse({ matches: [{ ...matchDraft, similarity: 0.9 }] });
    expect(parsed.matches[0]).not.toHaveProperty("similarity");
  });

  it.each([
    ["a Match citing neither a Statement nor a Fact", { matches: [{ ...matchDraft, statementId: null }] }],
    ["a Match citing both a Statement and a Fact", { matches: [{ ...matchDraft, factId: FACT_ID }] }],
    ["a Match without a reason", { matches: [{ ...matchDraft, reason: "" }] }],
    ["a Match that names no Requirement", { matches: [{ ...matchDraft, requirementId: null }] }],
    ["a score instead of Matches", { score: 7 }],
  ])("rejects %s", (_label, input) => {
    expect(MatchesOutputSchema.safeParse(input).success).toBe(false);
  });
});

describe("MatchSchema", () => {
  it("accepts a stored Match", () => {
    expect(MatchSchema.safeParse(match).success).toBe(true);
  });

  it("rejects a stored Match citing both a Statement and a Fact", () => {
    expect(MatchSchema.safeParse({ ...match, factId: FACT_ID }).success).toBe(false);
  });
});

describe("RequirementMatchResultSchema", () => {
  it("accepts the Requirements, the Matches, and the copies they cite", () => {
    expect(RequirementMatchResultSchema.safeParse(result).success).toBe(true);
  });

  it("accepts a Fact citation that resolves to a copied Fact", () => {
    const factMatch = { ...match, statementId: null, factId: FACT_ID };
    expect(RequirementMatchResultSchema.safeParse({ ...result, matches: [factMatch], citedStatements: [], citedFacts: [educationFact] }).success).toBe(true);
  });

  it("accepts Requirements with no Match, which are all Weaknesses", () => {
    expect(RequirementMatchResultSchema.safeParse({ ...result, matches: [], citedStatements: [] }).success).toBe(true);
  });

  it.each([
    ["no Requirement at all", { ...result, requirements: [], matches: [], citedStatements: [] }],
    ["a Match of a Requirement that is not there", { ...result, matches: [{ ...match, requirementId: OTHER_ID }] }],
    ["a Match citing a Statement with no copy kept", { ...result, citedStatements: [] }],
    ["a Match citing a Fact with no copy kept", { ...result, matches: [{ ...match, statementId: null, factId: FACT_ID }], citedStatements: [] }],
    ["a copied Statement without its Evidence quote", { ...result, citedStatements: [{ ...citedStatement, evidenceQuotes: [] }] }],
  ])("rejects %s", (_label, input) => {
    expect(RequirementMatchResultSchema.safeParse(input).success).toBe(false);
  });
});
