import { describe, expect, it } from "vitest";

import { EMPTY_BASIC_PROFILE } from "./basic-profile.js";
import { ACCOUNT_ID, profile, without } from "./candidate.fixtures.js";
import { ProfileSchema, ReviewFlagSchema } from "./profile.js";

describe("ProfileSchema", () => {
  it("accepts a profile with the seven parts, its source, and its review flags", () => {
    expect(ProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("accepts the empty profile of an Account with no completed Ingestion", () => {
    const empty = {
      accountId: ACCOUNT_ID,
      basicProfile: EMPTY_BASIC_PROFILE,
      experiences: [],
      education: [],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      yearsOfExperience: 0,
      reviewFlags: [],
      source: null,
      confirmedAt: null,
    };

    expect(ProfileSchema.safeParse(empty).success).toBe(true);
  });

  it("accepts a confirmed profile with no flags", () => {
    expect(ProfileSchema.safeParse({ ...profile, reviewFlags: [], confirmedAt: "2026-09-03T08:00:00.000Z" }).success).toBe(true);
  });

  it.each([
    ["a missing account id", without(profile, "accountId")],
    ["an invalid nested experience", { ...profile, experiences: [{ ...profile.experiences[0], role: "" }] }],
    ["a basic profile with a name", { ...profile, basicProfile: { ...profile.basicProfile, fullName: "Ada Lovelace" } }],
    ["experiences that are not a list", { ...profile, experiences: profile.experiences[0] }],
    ["negative years of experience", { ...profile, yearsOfExperience: -1 }],
    ["a flag with an unknown reason", { ...profile, reviewFlags: [{ ...profile.reviewFlags[0], reason: "guess" }] }],
    ["a source without its ingestion", { ...profile, source: without(profile.source!, "ingestionId") }],
  ])("rejects %s", (_label, input) => {
    expect(ProfileSchema.strict().safeParse(input).success).toBe(false);
  });
});

describe("ReviewFlagSchema", () => {
  it("accepts a flag on the Basic Profile with no entry", () => {
    expect(ReviewFlagSchema.safeParse({ part: "basicProfile", entry: null, field: "name", reason: "account_mismatch" }).success).toBe(true);
  });
});
