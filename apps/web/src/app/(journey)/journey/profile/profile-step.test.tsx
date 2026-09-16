import type { Profile } from "@helpmegethired/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelChoiceRefusedError } from "../../../../lib/model-choice-refused-error";
import { modelChoiceClient } from "../../../../lib/model-choice-client";
import type { Candidate } from "../candidate";
import { ProfileStep } from "./profile-step";

vi.mock("../../../../lib/model-choice-client", () => ({ modelChoiceClient: { read: vi.fn() } }));
vi.mock("./actions", () => ({
  confirmProfileAction: vi.fn(),
  readResumeAgainAction: vi.fn(),
  correctBasicProfileAction: vi.fn(),
  saveExperienceAction: vi.fn(),
  removeExperienceAction: vi.fn(),
}));
vi.mock("../../../(account)/actions", () => ({ signOutAction: vi.fn() }));

const candidate: Candidate = {
  token: "session-token",
  account: { id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91", email: "ada@candidate.example", name: "Ada", lastName: "Lovelace", phone: null, address: null, createdAt: "2026-09-01T09:00:00.000Z" },
  initials: "AL",
  name: "Ada Lovelace",
};

const profile: Profile = {
  accountId: candidate.account.id,
  basicProfile: { headline: "Backend engineer", summary: null, linkedinUrl: null, githubUrl: null },
  experiences: [],
  education: [],
  projects: [],
  skills: [],
  languages: [],
  certifications: [],
  yearsOfExperience: 0,
  reviewFlags: [],
  corrections: { basicProfile: false, entryIds: [] },
  source: {
    kind: "upload",
    uploadedResumeId: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
    fileName: "ada-lovelace.pdf",
    ingestionId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    completedAt: "2026-09-16T10:00:00.000Z",
  },
  confirmedAt: null,
};

const offer = { name: "Read my résumé again with your AI" };

const choice = (keyStored: boolean) => ({ choice: { provider: "anthropic", modelId: "claude-sonnet-5", keyStored } }) as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileStep", () => {
  it("offers reading the résumé again when a Model Key is stored, asking with the Candidate's Session", async () => {
    vi.mocked(modelChoiceClient.read).mockResolvedValue(choice(true));

    render(await ProfileStep({ candidate, profile }));

    expect(modelChoiceClient.read).toHaveBeenCalledWith("session-token");
    expect(screen.getByRole("button", offer)).toBeInTheDocument();
    expect(screen.getByText(/We kept the text of ada-lovelace\.pdf/)).toBeInTheDocument();
  });

  it.each([
    ["the key was revoked", () => vi.mocked(modelChoiceClient.read).mockResolvedValue(choice(false))],
    ["no Model has been chosen", () => vi.mocked(modelChoiceClient.read).mockResolvedValue({ choice: null })],
    ["the Model Choice could not be read", () => vi.mocked(modelChoiceClient.read).mockRejectedValue(new ModelChoiceRefusedError(undefined, 502))],
  ])("offers nothing of the kind when %s, and still shows the Profile", async (_case, arrange) => {
    arrange();

    render(await ProfileStep({ candidate, profile }));

    expect(screen.queryByRole("button", offer)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ada Lovelace");
  });
});
