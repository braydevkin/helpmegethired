import { describe, expect, it } from "vitest";

import { UPLOADED_RESUME_ID, experience } from "./candidate.fixtures.js";
import { CURATION_UNIT_INPUT_MAX_CHARACTERS } from "./curation.js";
import { CurationStatementsSchema, EvidenceSchema, StatementReviewRequestSchema, StatementReviewSchema, StatementSchema } from "./statement.js";

const quote = "Leads the ingestion platform";

const evidence = {
  kind: "experience",
  referenceId: experience.id,
  quote,
  start: 0,
  end: quote.length,
};

describe("EvidenceSchema", () => {
  it("accepts a quote whose offsets span exactly its length", () => {
    expect(EvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it("accepts a span of the extracted text of an Uploaded Resume", () => {
    expect(EvidenceSchema.safeParse({ ...evidence, kind: "text_span", referenceId: UPLOADED_RESUME_ID, start: 120, end: 120 + quote.length }).success).toBe(
      true,
    );
  });

  it.each([
    ["an end before the start", { ...evidence, start: 10, end: 4 }],
    ["an empty span", { ...evidence, start: 4, end: 4 }],
    ["offsets wider than the quote", { ...evidence, end: quote.length + 1 }],
    ["a negative start", { ...evidence, start: -1, end: quote.length - 1 }],
    ["an empty quote", { ...evidence, quote: "", end: 0 }],
    ["a quote longer than a unit's input", { ...evidence, quote: "a".repeat(CURATION_UNIT_INPUT_MAX_CHARACTERS + 1), end: CURATION_UNIT_INPUT_MAX_CHARACTERS + 1 }],
    ["an unknown kind", { ...evidence, kind: "education" }],
    ["a reference that is not an id", { ...evidence, referenceId: "the first job" }],
  ])("rejects %s", (_label, input) => {
    expect(EvidenceSchema.safeParse(input).success).toBe(false);
  });
});

describe("StatementReviewSchema", () => {
  it.each([
    ["accepted, with the time", { state: "accepted", reviewedAt: "2026-09-10T11:00:00.000Z" }],
    ["rejected, with the time", { state: "rejected", reviewedAt: "2026-09-10T11:00:00.000Z" }],
    ["not yet reviewed, with no time", { state: "unreviewed", reviewedAt: null }],
  ])("accepts a Statement %s", (_label, input) => {
    expect(StatementReviewSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["a rejection with no time", { state: "rejected", reviewedAt: null }],
    ["an unreviewed Statement with a time", { state: "unreviewed", reviewedAt: "2026-09-10T11:00:00.000Z" }],
    ["an unknown state", { state: "liked", reviewedAt: null }],
  ])("rejects %s", (_label, input) => {
    expect(StatementReviewSchema.safeParse(input).success).toBe(false);
  });
});

describe("StatementSchema", () => {
  const statement = {
    id: "7e6f5a4b-8c9d-4e0f-9a1b-3c4d5e6f7a8b",
    text: "Leads the ingestion platform at Analytical Engines Ltd since March 2021.",
    labels: ["leadership", "data platform"],
    evidence: [evidence],
    promptVersion: "experience/1",
    modelId: "claude-sonnet-5",
    review: { state: "unreviewed", reviewedAt: null },
    createdAt: "2026-09-10T10:30:00.000Z",
  };

  it("accepts a Statement with its Evidence, versions and review", () => {
    expect(StatementSchema.safeParse(statement).success).toBe(true);
  });

  it("keeps a Statement written by a model that is no longer in the catalogue readable", () => {
    expect(StatementSchema.safeParse({ ...statement, modelId: "claude-sonnet-4-5" }).success).toBe(true);
  });

  it.each([
    ["no Evidence", { ...statement, evidence: [] }],
    ["Evidence that does not resolve its own quote", { ...statement, evidence: [{ ...evidence, end: 3 }] }],
    ["no prompt version", { ...statement, promptVersion: "" }],
    ["an empty sentence", { ...statement, text: "  " }],
    ["no review", { ...statement, review: undefined }],
  ])("rejects %s", (_label, input) => {
    expect(StatementSchema.safeParse(input).success).toBe(false);
  });
});

describe("CurationStatementsSchema", () => {
  const curated = {
    id: "7e6f5a4b-8c9d-4e0f-9a1b-3c4d5e6f7a8b",
    text: "Leads the ingestion platform at Analytical Engines Ltd since March 2021.",
    labels: ["leadership"],
    evidence: [evidence],
    promptVersion: "curation/1",
    modelId: "claude-sonnet-5",
    review: { state: "rejected", reviewedAt: "2026-09-10T11:00:00.000Z" },
    createdAt: "2026-09-10T10:30:00.000Z",
    source: { unitKind: "experience", title: "Staff Engineer at Analytical Engines Ltd" },
  };

  it("accepts the Statements of a Curation, each with the unit it came from", () => {
    expect(CurationStatementsSchema.safeParse({ curationId: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a", statements: [curated] }).success).toBe(true);
  });

  it("accepts no Curation yet, with no Statements", () => {
    expect(CurationStatementsSchema.safeParse({ curationId: null, statements: [] }).success).toBe(true);
  });

  it.each([
    ["Statements with no Curation", { curationId: null, statements: [curated] }],
    ["a Statement with no source", { curationId: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a", statements: [{ ...curated, source: undefined }] }],
    ["a source of an unknown unit kind", { curationId: "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a", statements: [{ ...curated, source: { unitKind: "education", title: "BSc" } }] }],
  ])("rejects %s", (_label, input) => {
    expect(CurationStatementsSchema.safeParse(input).success).toBe(false);
  });

  it("says in its contract that a review is not carried across a re-run", () => {
    expect(CurationStatementsSchema.description).toMatch(/not carried to the Statements of a re-run/);
  });
});

describe("StatementReviewRequestSchema", () => {
  it.each(["accepted", "rejected", "unreviewed"])("accepts %s", (state) => {
    expect(StatementReviewRequestSchema.safeParse({ state }).success).toBe(true);
  });

  it.each([
    ["an unknown state", { state: "liked" }],
    ["no state", {}],
  ])("rejects %s", (_label, input) => {
    expect(StatementReviewRequestSchema.safeParse(input).success).toBe(false);
  });
});
