import { describe, expect, it } from "vitest";

import { profile, without } from "./candidate.fixtures.js";
import { ProfileSchema } from "./profile.js";

describe("ProfileSchema", () => {
  it("accepts a profile with a basic profile, experiences, and projects", () => {
    expect(ProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("accepts a profile with no experiences or projects yet", () => {
    const empty = { ...profile, experiences: [], projects: [] };
    expect(ProfileSchema.safeParse(empty).success).toBe(true);
  });

  it.each([
    ["a missing account id", without(profile, "accountId")],
    ["an invalid nested experience", { ...profile, experiences: [{ ...profile.experiences[0], role: "" }] }],
    ["an invalid nested basic profile", { ...profile, basicProfile: { fullName: "Ada Lovelace" } }],
    ["experiences that are not a list", { ...profile, experiences: profile.experiences[0] }],
  ])("rejects %s", (_label, input) => {
    expect(ProfileSchema.safeParse(input).success).toBe(false);
  });
});
