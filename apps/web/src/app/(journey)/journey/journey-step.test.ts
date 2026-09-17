import type { ProfileSource } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { journeyStepOf, modelKeyStoredOf, stepAfterModelChoiceOf } from "./journey-step";

const source: ProfileSource = {
  kind: "upload",
  uploadedResumeId: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  fileName: "ada.pdf",
  ingestionId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  completedAt: "2026-09-11T10:00:00.000Z",
};

const noProfile = { source: null, confirmedAt: null };
const builtProfile = { source, confirmedAt: null };
const confirmedProfile = { source, confirmedAt: "2026-09-11T11:00:00.000Z" };

describe("journeyStepOf", () => {
  it("opens on choosing the AI for a new Account with no key", () => {
    expect(journeyStepOf({ modelKeyStored: false, profile: noProfile })).toBe("ai");
  });

  it.each([
    ["a built Profile", builtProfile],
    ["a confirmed Profile", confirmedProfile],
  ])("opens on choosing the AI for an Account with %s but no key", (_label, profile) => {
    expect(journeyStepOf({ modelKeyStored: false, profile })).toBe("ai");
  });

  it("opens on the résumé once a key is stored and no Ingestion has built a Profile", () => {
    expect(journeyStepOf({ modelKeyStored: true, profile: noProfile })).toBe("resume");
  });

  it("opens on the Profile review until the Candidate confirms it", () => {
    expect(journeyStepOf({ modelKeyStored: true, profile: builtProfile })).toBe("profile");
  });

  it("opens on the analysis once the Profile is confirmed", () => {
    expect(journeyStepOf({ modelKeyStored: true, profile: confirmedProfile })).toBe("analysis");
  });
});

describe("stepAfterModelChoiceOf", () => {
  it.each([
    [noProfile, "resume"],
    [builtProfile, "profile"],
    [confirmedProfile, "analysis"],
  ] as const)("answers the step the journey opens on once a key is stored", (profile, step) => {
    expect(stepAfterModelChoiceOf(profile)).toBe(step);
    expect(journeyStepOf({ modelKeyStored: true, profile })).toBe(step);
  });
});

describe("modelKeyStoredOf", () => {
  it.each([
    ["no choice", { choice: null }, false],
    ["a choice whose key was revoked", { choice: { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: false } }, false],
    ["a choice with a stored key", { choice: { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true } }, true],
  ] as const)("reads %s", (_label, state, stored) => {
    expect(modelKeyStoredOf(state)).toBe(stored);
  });
});
