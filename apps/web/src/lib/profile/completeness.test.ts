import type { Profile } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { completenessOf } from "./completeness";

const ACCOUNT_ID = "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91";

const id = () => crypto.randomUUID();

const complete: Profile = {
  accountId: ACCOUNT_ID,
  basicProfile: {
    headline: "Backend engineer",
    summary: "Ten years building distributed systems.",
    linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
    githubUrl: "https://github.com/ada",
  },
  experiences: [{ id: id(), company: "Analytical Engines Ltd", role: "Engineer", period: null, description: null, skills: [] }],
  education: [{ id: id(), institution: "University of Cambridge", degree: "MSc", fieldOfStudy: null, period: null }],
  projects: [],
  skills: ["TypeScript", "Go", "Docker"].map((name) => ({ id: id(), name, category: "Languages & runtimes" as const })),
  languages: [{ id: id(), name: "English", level: "Native" }],
  certifications: [],
  yearsOfExperience: 7,
  reviewFlags: [],
  source: null,
  confirmedAt: null,
};

describe("completenessOf", () => {
  it("gives a Profile with all eight points 100% and nothing to add", () => {
    expect(completenessOf(complete)).toEqual({ percentage: 100, hint: "Nothing is missing — your Profile has everything the analysis looks for." });
  });

  it("counts one point for each of the eight", () => {
    expect(completenessOf({ ...complete, languages: [] }).percentage).toBe(88);
    expect(completenessOf({ ...complete, languages: [], education: [] }).percentage).toBe(75);
  });

  it("needs three Skills for the point", () => {
    expect(completenessOf({ ...complete, skills: complete.skills.slice(0, 2) }).percentage).toBe(88);
    expect(completenessOf({ ...complete, skills: complete.skills.slice(0, 3) }).percentage).toBe(100);
  });

  it("names the two first missing points in the hint", () => {
    const { hint } = completenessOf({ ...complete, basicProfile: { ...complete.basicProfile, summary: null, githubUrl: null }, languages: [] });

    expect(hint).toBe("Add a summary line and your GitHub URL to reach 100% and unlock better role matching.");
  });
});
