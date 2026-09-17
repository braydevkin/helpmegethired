import { randomUUID } from "node:crypto";

import { EvidenceSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { citableKey, resolveEvidence } from "./evidence-resolution";

const experienceId = randomUUID();
const projectId = randomUUID();
const texts = new Map([
  [citableKey("experience", experienceId), "Runs the deployment platform for forty teams. Cut the pipeline from 22 to 9 minutes."],
  [citableKey("project", projectId), "Rotates short-lived database credentials."],
]);

describe("resolveEvidence", () => {
  it("finds each quote in the text its citation names and records where it stands", () => {
    const evidence = resolveEvidence(
      [
        { kind: "experience", referenceId: experienceId, quote: "Cut the pipeline from 22 to 9 minutes." },
        { kind: "project", referenceId: projectId, quote: "short-lived database credentials" },
      ],
      texts,
    );

    const at = (kind: "experience" | "project", referenceId: string, quote: string) => {
      const start = texts.get(citableKey(kind, referenceId))?.indexOf(quote) ?? -1;

      return { kind, referenceId, quote, start, end: start + quote.length };
    };

    expect(evidence).toEqual([
      at("experience", experienceId, "Cut the pipeline from 22 to 9 minutes."),
      at("project", projectId, "short-lived database credentials"),
    ]);
    expect(evidence?.map((entry) => entry.start)).toEqual([46, 8]);
    for (const entry of evidence ?? []) {
      expect(EvidenceSchema.parse(entry)).toEqual(entry);
      expect(texts.get(citableKey(entry.kind, entry.referenceId))?.slice(entry.start, entry.end)).toBe(entry.quote);
    }
  });

  it.each([
    ["a quote the text does not contain", { kind: "experience" as const, referenceId: experienceId, quote: "Led a team of 50 at Google." }],
    ["a quote reworded from the text", { kind: "experience" as const, referenceId: experienceId, quote: "Runs the platform for forty teams." }],
    ["a text the Profile does not have", { kind: "project" as const, referenceId: randomUUID(), quote: "Rotates" }],
    ["the right quote under the wrong kind", { kind: "project" as const, referenceId: experienceId, quote: "Runs the deployment platform" }],
  ])("rejects the Statement for %s", (_label, citation) => {
    expect(resolveEvidence([{ kind: "experience", referenceId: experienceId, quote: "Runs the deployment platform" }, citation], texts)).toBeUndefined();
  });
});
