import { describe, expect, it } from "vitest";

import { educationFact } from "./candidate.fixtures.js";
import { FactSchema } from "./fact.js";

const years = { id: "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a", kind: "years_of_experience", text: "10 years of experience", sourceId: null };

describe("FactSchema", () => {
  it("accepts a Fact that restates a part of the confirmed Profile", () => {
    expect(FactSchema.safeParse(educationFact).success).toBe(true);
  });

  it("accepts the years of experience, which are counted across every Experience", () => {
    expect(FactSchema.safeParse(years).success).toBe(true);
  });

  it.each([
    ["an Education Fact that names no source", { ...educationFact, sourceId: null }],
    ["years of experience that name a source", { ...years, sourceId: educationFact.sourceId }],
    ["a Fact of an unknown kind", { ...educationFact, kind: "experience" }],
    ["a Fact with no text", { ...educationFact, text: " " }],
    ["a Fact without an id", { ...educationFact, id: "the degree" }],
  ])("rejects %s", (_label, input) => {
    expect(FactSchema.safeParse(input).success).toBe(false);
  });
});
