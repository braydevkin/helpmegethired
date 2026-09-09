import type { Profile } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { profileViewOf } from "./profile-view";

const id = () => crypto.randomUUID();

const profile: Profile = {
  accountId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  basicProfile: { headline: "Backend engineer", summary: null, linkedinUrl: null, githubUrl: null },
  experiences: [
    { id: id(), company: "Northwind Labs", role: "Senior Backend Engineer", period: { start: "2022-03", end: null }, description: "Owns payments.", skills: ["Node.js"] },
    { id: id(), company: null, role: "Freelance Developer", period: { start: "2017-01", end: "2018-06" }, description: null, skills: [] },
  ],
  education: [
    { id: id(), institution: "Universidade de Lisboa", degree: "BSc", fieldOfStudy: "Computer Science", period: { start: "2013-09", end: "2017-06" } },
    { id: id(), institution: "Open University", degree: null, fieldOfStudy: null, period: null },
  ],
  projects: [{ id: id(), name: "Queue Inspector", description: "Replays failed jobs.", url: null, skills: ["TypeScript", "BullMQ"] }],
  skills: [
    { id: id(), name: "TypeScript", category: "Languages & runtimes" },
    { id: id(), name: "Docker", category: "Infrastructure" },
  ],
  languages: [{ id: id(), name: "English", level: "Native" }],
  certifications: [
    { id: id(), name: "AWS Solutions Architect", issuer: "Amazon Web Services", year: 2024 },
    { id: id(), name: "Scrum Developer", issuer: null, year: null },
  ],
  yearsOfExperience: 7,
  reviewFlags: [{ part: "experience", entry: "Freelance Developer", field: "period", reason: "low_confidence" }],
  source: { kind: "upload", uploadedResumeId: id(), fileName: "ana.pdf", ingestionId: id(), completedAt: "2026-09-08T10:00:00.000Z" },
  confirmedAt: null,
};

describe("profileViewOf", () => {
  it("names the Uploaded Resume the Profile came from, and says so even when it has no name", () => {
    expect(profileViewOf(profile).sourceLabel).toBe("Extracted from ana.pdf");
    expect(profileViewOf({ ...profile, source: null }).sourceLabel).toBe("Extracted from your résumé");
  });

  it("joins the headline with the years of experience, and drops the headline it does not have", () => {
    expect(profileViewOf(profile).headline).toBe("Backend engineer · 7 years of experience");
    expect(profileViewOf({ ...profile, basicProfile: { ...profile.basicProfile, headline: null }, yearsOfExperience: 1 }).headline).toBe("1 year of experience");
  });

  it("counts the four stat tiles from the Profile", () => {
    expect(profileViewOf(profile).stats).toEqual([
      { value: 7, label: "Years of experience" },
      { value: 2, label: "Roles" },
      { value: 2, label: "Skills" },
      { value: 1, label: "Projects" },
    ]);
  });

  it("hangs the review note on the Experience the flag names", () => {
    const [senior, freelance] = profileViewOf(profile).experiences;

    expect(senior?.note).toBeNull();
    expect(senior?.period).toBe("2022 — present");
    expect(freelance?.note).toBe("Dates need confirming — the PDF lists only years.");
  });

  it("runs the Experience heading from the first year worked to today while a position is held", () => {
    expect(profileViewOf(profile).experienceMeta).toBe("2 roles · 2017 — present");
    expect(profileViewOf({ ...profile, experiences: profile.experiences.slice(0, 1) }).experienceMeta).toBe("1 role · 2022 — present");
  });

  it("titles Education with the degree and field of study, and falls back to the institution without repeating it", () => {
    const [degree, bare] = profileViewOf(profile).education;

    expect(degree).toMatchObject({ title: "BSc · Computer Science", institution: "Universidade de Lisboa", period: "2013 — 2017" });
    expect(bare).toMatchObject({ title: "Open University", institution: null, period: null });
  });

  it("joins a project's skills into its stack line and a certification's issuer and year into its meta", () => {
    const view = profileViewOf(profile);

    expect(view.projects[0]?.stack).toBe("TypeScript · BullMQ");
    expect(view.certifications).toEqual([{ name: "AWS Solutions Architect", meta: "Amazon Web Services · 2024" }, { name: "Scrum Developer", meta: null }]);
  });

  it("groups the Skills by category and counts them beside the heading", () => {
    const view = profileViewOf(profile);

    expect(view.skillGroups).toEqual([
      { name: "Languages & runtimes", skills: ["TypeScript"] },
      { name: "Infrastructure", skills: ["Docker"] },
    ]);
    expect(view.skillsMeta).toBe("2 extracted");
  });

  it("has no review notice once the Profile carries no flags", () => {
    expect(profileViewOf(profile).notice?.title).toBe("1 field needs your eyes");
    expect(profileViewOf({ ...profile, reviewFlags: [] }).notice).toBeNull();
  });
});
