import type { UploadedResume } from "@helpmegethired/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resumeClient } from "../../../../lib/resume-client";
import type { Candidate } from "../candidate";
import { ResumeStep } from "./resume-step";

vi.mock("../../../../lib/resume-client", () => ({ resumeClient: { list: vi.fn() } }));
vi.mock("./actions", () => ({ createResumeAction: vi.fn(), completeResumeAction: vi.fn(), readResumeAction: vi.fn() }));
vi.mock("../../../(account)/actions", () => ({ signOutAction: vi.fn() }));

const candidate: Candidate = {
  token: "session-token",
  account: { id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91", email: "ada@candidate.example", name: "Ada", lastName: "Lovelace", phone: null, address: null, createdAt: "2026-09-01T09:00:00.000Z" },
  initials: "AL",
  name: "Ada Lovelace",
};

const resume = (overrides: Partial<UploadedResume>): UploadedResume => ({
  id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  accountId: candidate.account.id,
  createdAt: "2026-09-08T10:00:00.000Z",
  source: "upload",
  fileName: "ada.pdf",
  contentType: "application/pdf",
  sizeBytes: 8,
  sha256: "a".repeat(64),
  status: "done",
  errorCode: null,
  finishedAt: "2026-09-08T10:01:00.000Z",
  progress: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResumeStep", () => {
  it("follows an older record read again over a newer one that failed", async () => {
    vi.mocked(resumeClient.list).mockResolvedValue([
      resume({ id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", fileName: "scanned.pdf", status: "failed", errorCode: "scanned_pdf" }),
      resume({ fileName: "ada.pdf", status: "processing", finishedAt: null }),
    ]);

    render(await ResumeStep({ candidate, modelKeyStored: true }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reading your résumé");
    expect(screen.getByText("ada.pdf")).toBeInTheDocument();
  });

  it("shows the newest record when nothing is in flight", async () => {
    vi.mocked(resumeClient.list).mockResolvedValue([resume({ fileName: "kenji.pdf" }), resume({ id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", fileName: "ada.pdf" })]);

    render(await ResumeStep({ candidate, modelKeyStored: true }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your profile is ready");
    expect(screen.getByText("kenji.pdf")).toBeInTheDocument();
  });

  it("starts over when the newest record never got its bytes", async () => {
    vi.mocked(resumeClient.list).mockResolvedValue([resume({ status: "pending", finishedAt: null })]);

    render(await ResumeStep({ candidate, modelKeyStored: true }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Upload your résumé");
  });
});
