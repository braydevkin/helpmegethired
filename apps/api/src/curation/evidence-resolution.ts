import type { Evidence, EvidenceCitation, EvidenceKind, Id } from "@helpmegethired/shared";

// The texts a Statement may quote, keyed by the kind and id a citation names.
export type CitableTexts = ReadonlyMap<string, string>;

export const citableKey = (kind: EvidenceKind, referenceId: Id): string => `${kind}:${referenceId}`;

// A quote counts only where it stands verbatim in the text it names; its offsets are found here,
// never taken from the model. This is the one programmatic check against a hallucination entering
// the index as fact (ADR-0024), so one unresolved citation rejects the whole Statement.
export function resolveEvidence(citations: readonly EvidenceCitation[], texts: CitableTexts): Evidence[] | undefined {
  const evidence: Evidence[] = [];

  for (const { kind, referenceId, quote } of citations) {
    const start = texts.get(citableKey(kind, referenceId))?.indexOf(quote) ?? -1;

    if (start < 0) {
      return undefined;
    }

    evidence.push({ kind, referenceId, quote, start, end: start + quote.length });
  }

  return evidence;
}
