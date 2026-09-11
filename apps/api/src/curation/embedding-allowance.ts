import { CURATION_UNIT_INPUT_MAX_CHARACTERS } from "@helpmegethired/shared";

import { CURATION_MAX_ATTEMPTS } from "./curation-job-options";

// The spend is estimated from the texts before any call is made, at the ratio the fake model uses.
const CHARACTERS_PER_TOKEN = 4;

// Measured over the 30 résumés of the parser corpus: at most 8 units per Curation, median 4.
const LARGEST_CORPUS_CURATION_UNITS = 8;

// A first Curation and the re-runs #118 allows after a change, each free to use every attempt.
const CURATIONS_PER_DAY = 4;

// The arithmetic is argued in docs/security.md, "Spend".
export const DEFAULT_DAILY_EMBEDDING_TOKENS =
  LARGEST_CORPUS_CURATION_UNITS * Math.ceil(CURATION_UNIT_INPUT_MAX_CHARACTERS / CHARACTERS_PER_TOKEN) * CURATION_MAX_ATTEMPTS * CURATIONS_PER_DAY;

export function embeddingTokensOf(texts: readonly string[]): number {
  return texts.reduce((total, text) => total + Math.ceil(text.length / CHARACTERS_PER_TOKEN), 0);
}

// A period is one UTC day, named by the date it starts on.
export function embeddingPeriodOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextEmbeddingPeriodOf(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
