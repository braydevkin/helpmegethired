import { describe, expect, it } from "vitest";

import { BasicProfileSchema } from "./basic-profile.js";
import { basicProfile } from "./candidate.fixtures.js";

describe("BasicProfileSchema", () => {
  it("accepts a complete basic profile", () => {
    expect(BasicProfileSchema.safeParse(basicProfile).success).toBe(true);
  });

  it("accepts a basic profile with only the required fields", () => {
    const minimal = { fullName: "Ada Lovelace", headline: "Backend engineer" };
    expect(BasicProfileSchema.safeParse(minimal).success).toBe(true);
  });

  it("trims surrounding whitespace from text fields", () => {
    const parsed = BasicProfileSchema.parse({ ...basicProfile, fullName: "  Ada Lovelace  " });
    expect(parsed.fullName).toBe("Ada Lovelace");
  });

  it.each([
    ["a blank full name", { ...basicProfile, fullName: "   " }],
    ["a missing headline", { fullName: "Ada Lovelace" }],
    ["a LinkedIn value that is not a URL", { ...basicProfile, linkedinUrl: "ada-lovelace" }],
  ])("rejects %s", (_label, input) => {
    expect(BasicProfileSchema.safeParse(input).success).toBe(false);
  });
});
