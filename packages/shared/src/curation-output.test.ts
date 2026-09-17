import { describe, expect, it } from "vitest";

import { experience } from "./candidate.fixtures.js";
import { CurationUnitOutputSchema } from "./curation-output.js";

const citation = { kind: "experience", referenceId: experience.id, quote: "Leads the ingestion platform." };
const statement = { text: "Leads the ingestion platform at Analytical Engines Ltd.", labels: ["leadership"], evidence: [citation] };

describe("CurationUnitOutputSchema", () => {
  it("accepts Statements that each cite what they quote", () => {
    expect(CurationUnitOutputSchema.safeParse({ statements: [statement] }).success).toBe(true);
  });

  it("accepts a unit that found nothing to say", () => {
    expect(CurationUnitOutputSchema.safeParse({ statements: [] }).success).toBe(true);
  });

  it.each([
    ["a Statement with no Evidence", { statements: [{ ...statement, evidence: [] }] }],
    ["an empty sentence", { statements: [{ ...statement, text: " " }] }],
    ["an empty quote", { statements: [{ ...statement, evidence: [{ ...citation, quote: "" }] }] }],
    ["a citation of an unknown kind", { statements: [{ ...statement, evidence: [{ ...citation, kind: "education" }] }] }],
    ["a citation that names no id", { statements: [{ ...statement, evidence: [{ ...citation, referenceId: "the first job" }] }] }],
    ["plain text instead of JSON", "Leads the ingestion platform."],
    ["a score instead of Statements", { score: 11 }],
  ])("rejects %s", (_label, input) => {
    expect(CurationUnitOutputSchema.safeParse(input).success).toBe(false);
  });
});
