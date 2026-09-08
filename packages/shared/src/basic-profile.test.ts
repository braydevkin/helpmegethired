import { describe, expect, it } from "vitest";

import { BasicProfileSchema, EMPTY_BASIC_PROFILE } from "./basic-profile.js";
import { basicProfile } from "./candidate.fixtures.js";

describe("BasicProfileSchema", () => {
  it("accepts a complete basic profile", () => {
    expect(BasicProfileSchema.safeParse(basicProfile).success).toBe(true);
  });

  it("accepts the empty basic profile of an Account with nothing recognised yet", () => {
    expect(BasicProfileSchema.safeParse(EMPTY_BASIC_PROFILE).success).toBe(true);
  });

  it("trims surrounding whitespace from text fields", () => {
    expect(BasicProfileSchema.parse({ ...basicProfile, headline: "  Backend engineer  " }).headline).toBe("Backend engineer");
  });

  it.each([
    ["a blank headline", { ...basicProfile, headline: "   " }],
    ["a missing summary", { headline: "Backend engineer", linkedinUrl: null, githubUrl: null }],
    ["a LinkedIn value that is not a URL", { ...basicProfile, linkedinUrl: "ada-lovelace" }],
    ["a name, which belongs to the Account", { ...basicProfile, fullName: "Ada Lovelace" }],
  ])("rejects %s", (_label, input) => {
    expect(BasicProfileSchema.safeParse(input).success).toBe(false);
  });
});
