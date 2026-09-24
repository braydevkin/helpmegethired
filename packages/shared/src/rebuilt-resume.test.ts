import { describe, expect, it } from "vitest";

import { FACT_ID, STATEMENT_ID, citedStatement, educationFact, rebuiltResume } from "./candidate.fixtures.js";
import { RebuiltResumeContentSchema, RebuiltResumeOutputSchema, RebuiltSentenceSchema } from "./rebuilt-resume.js";

const OTHER_ID = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";

const sentence = { text: "Runs the ingestion platform of Analytical Engines Ltd.", sources: [{ statementId: STATEMENT_ID, factId: null }] };
const section = { kind: "experience", title: "Senior Software Engineer, Analytical Engines Ltd", sentences: [sentence] };
const content = rebuiltResume.content;

describe("RebuiltSentenceSchema", () => {
  it("accepts a sentence that cites a Statement and a Fact", () => {
    expect(RebuiltSentenceSchema.safeParse({ ...sentence, sources: [...sentence.sources, { statementId: null, factId: FACT_ID }] }).success).toBe(true);
  });

  it.each([
    ["a sentence without a citation", { ...sentence, sources: [] }],
    ["a sentence with no sources at all", { text: sentence.text }],
    ["a sentence whose citation names neither a Statement nor a Fact", { ...sentence, sources: [{ statementId: null, factId: null }] }],
    ["a sentence whose citation names both", { ...sentence, sources: [{ statementId: STATEMENT_ID, factId: FACT_ID }] }],
    ["an empty sentence", { ...sentence, text: " " }],
  ])("rejects %s", (_label, input) => {
    expect(RebuiltSentenceSchema.safeParse(input).success).toBe(false);
  });
});

describe("RebuiltResumeOutputSchema", () => {
  it("accepts sections of cited sentences", () => {
    expect(RebuiltResumeOutputSchema.safeParse({ sections: [section] }).success).toBe(true);
  });

  it("drops a header the Model wrote, since the header comes from the Account Information", () => {
    const parsed = RebuiltResumeOutputSchema.parse({ name: "Ada Lovelace", sections: [section] });
    expect(parsed).not.toHaveProperty("name");
  });

  it.each([
    ["no section", { sections: [] }],
    ["a section with no sentence", { sections: [{ ...section, sentences: [] }] }],
    ["a section of an unknown kind", { sections: [{ ...section, kind: "references" }] }],
    ["a section without a title", { sections: [{ ...section, title: "" }] }],
    ["plain text instead of JSON", "# Ada Lovelace"],
  ])("rejects %s", (_label, input) => {
    expect(RebuiltResumeOutputSchema.safeParse(input).success).toBe(false);
  });
});

describe("RebuiltResumeContentSchema", () => {
  it("accepts sections whose sentences all cite a copy that is kept", () => {
    expect(RebuiltResumeContentSchema.safeParse(content).success).toBe(true);
  });

  it("accepts a count of the sentences the rules dropped", () => {
    expect(RebuiltResumeContentSchema.safeParse({ ...content, droppedSentences: 3 }).success).toBe(true);
  });

  it.each([
    ["a sentence citing a Statement with no copy kept", { ...content, citedStatements: [] }],
    ["a sentence citing a Fact with no copy kept", { ...content, citedFacts: [] }],
    ["a sentence citing an unknown Statement", { ...content, sections: [{ ...section, sentences: [{ ...sentence, sources: [{ statementId: OTHER_ID, factId: null }] }] }] }],
    ["a negative dropped count", { ...content, droppedSentences: -1 }],
    ["a fractional dropped count", { ...content, droppedSentences: 0.5 }],
    ["copies without any section", { sections: [], citedStatements: [citedStatement], citedFacts: [educationFact], droppedSentences: 0 }],
  ])("rejects %s", (_label, input) => {
    expect(RebuiltResumeContentSchema.safeParse(input).success).toBe(false);
  });
});
