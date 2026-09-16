import type { ProfileSource } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { nextStepActionOf } from "./next-step-action";

const source: ProfileSource = {
  kind: "upload",
  uploadedResumeId: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  fileName: "ada.pdf",
  ingestionId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  completedAt: "2026-09-11T10:00:00.000Z",
};

describe("nextStepActionOf", () => {
  it("leads a Candidate with no Profile built to the résumé", () => {
    expect(nextStepActionOf({ source: null, confirmedAt: null })).toMatchObject({ href: "/journey/resume", label: "Continue to your résumé" });
  });

  it("leads a Candidate whose Profile awaits review to the Profile", () => {
    expect(nextStepActionOf({ source, confirmedAt: null })).toMatchObject({ href: "/journey/profile", label: "Continue to your profile" });
  });

  it("leads a Candidate with a confirmed Profile to the analysis", () => {
    expect(nextStepActionOf({ source, confirmedAt: "2026-09-11T11:00:00.000Z" })).toMatchObject({ href: "/journey/analysis", label: "Continue to the analysis" });
  });
});
