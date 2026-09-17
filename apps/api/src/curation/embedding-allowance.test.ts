import { describe, expect, it } from "vitest";

import { DEFAULT_DAILY_EMBEDDING_TOKENS, embeddingPeriodOf, embeddingTokensOf, nextEmbeddingPeriodOf } from "./embedding-allowance";

describe("embeddingTokensOf", () => {
  it("counts a token for every four characters of each text, rounding each text up", () => {
    expect(embeddingTokensOf(["abcd", "abcde"])).toBe(3);
  });

  it("counts nothing for nothing to embed", () => {
    expect(embeddingTokensOf([])).toBe(0);
  });
});

describe("DEFAULT_DAILY_EMBEDDING_TOKENS", () => {
  it("is 8 units × 2,000 tokens × 3 attempts × 4 Curations, the arithmetic docs/security.md argues", () => {
    expect(DEFAULT_DAILY_EMBEDDING_TOKENS).toBe(192_000);
  });
});

describe("embeddingPeriodOf", () => {
  it("names the UTC day an instant falls on", () => {
    expect(embeddingPeriodOf(new Date("2026-09-11T23:59:59.999Z"))).toBe("2026-09-11");
    expect(embeddingPeriodOf(new Date("2026-09-12T00:00:00.000Z"))).toBe("2026-09-12");
  });
});

describe("nextEmbeddingPeriodOf", () => {
  it.each([
    ["the next UTC midnight", "2026-09-11T14:32:00.000Z", "2026-09-12T00:00:00.000Z"],
    ["the first of the next month", "2026-09-30T23:10:00.000Z", "2026-10-01T00:00:00.000Z"],
    ["the first of the next year", "2026-12-31T08:00:00.000Z", "2027-01-01T00:00:00.000Z"],
  ])("starts at %s", (_label, now, next) => {
    expect(nextEmbeddingPeriodOf(new Date(now)).toISOString()).toBe(next);
  });
});
