import type { ProfileSource } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { journeyStepOf } from "./journey-step";

const source: ProfileSource = {
  kind: "upload",
  uploadedResumeId: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  fileName: "ada.pdf",
  ingestionId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  completedAt: "2026-09-11T10:00:00.000Z",
};

describe("journeyStepOf", () => {
  it("opens on the résumé until an Ingestion has built a Profile", () => {
    expect(journeyStepOf({ source: null, confirmedAt: null })).toBe("resume");
  });

  it("opens on the Profile review until the Candidate confirms it", () => {
    expect(journeyStepOf({ source, confirmedAt: null })).toBe("profile");
  });

  it("opens on the analysis once the Profile is confirmed", () => {
    expect(journeyStepOf({ source, confirmedAt: "2026-09-11T11:00:00.000Z" })).toBe("analysis");
  });
});
