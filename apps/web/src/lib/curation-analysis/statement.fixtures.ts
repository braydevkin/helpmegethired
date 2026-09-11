import { CuratedStatementSchema, CurationStatementsSchema, type CuratedStatement, type CurationStatements } from "@helpmegethired/shared";

const idOf = (index: number): string => `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`;

// The id of the Curation the progress fixtures answer, so a completed one owns these Statements.
export const CURATION_ID = "00000000-0000-4000-8000-000000000000";

// Parsed through the shared schema, so every payload a test renders is one the API may send.
export function statementOf(index: number, overrides: Partial<CuratedStatement> = {}): CuratedStatement {
  const quote = "restructured the listing queries";

  return CuratedStatementSchema.parse({
    id: idOf(index + 1),
    text: `Statement ${index + 1}: cut a listing endpoint's response time by restructuring its queries.`,
    labels: ["Performance", "Databases"],
    evidence: [{ kind: "experience", referenceId: idOf(100 + index), quote, start: 10, end: 10 + quote.length }],
    promptVersion: "curation/1",
    modelId: "claude-sonnet-5",
    review: { state: "unreviewed", reviewedAt: null },
    createdAt: "2026-09-11T14:00:00.000Z",
    source: { unitKind: "experience", title: `Role ${index + 1} at Company ${index + 1}` },
    ...overrides,
  });
}

export const statementsOf = (statements: readonly CuratedStatement[], curationId: string | null = CURATION_ID): CurationStatements =>
  CurationStatementsSchema.parse({ curationId, statements });
