import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileUnavailableError, profileClient } from "../../../../lib/profile-client";
import { ProfileRecognitionRefusedError, profileRecognitionClient } from "../../../../lib/profile-recognition-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { confirmProfileAction, readResumeAgainAction } from "./actions";

vi.mock("../../../../lib/profile-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/profile-client")>()),
  profileClient: { get: vi.fn(), confirm: vi.fn() },
}));
vi.mock("../../../../lib/profile-recognition-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/profile-recognition-client")>()),
  profileRecognitionClient: { start: vi.fn() },
}));
vi.mock("../../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSessionToken).mockResolvedValue("session-token");
});

describe("confirmProfileAction", () => {
  it("confirms with the Session and moves on to the analysis", async () => {
    vi.mocked(profileClient.confirm).mockResolvedValue({} as never);

    await expect(confirmProfileAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(profileClient.confirm).toHaveBeenCalledWith("session-token");
    expect(redirect).toHaveBeenCalledWith("/journey/analysis");
  });

  it("asks to sign in again without a Session, and never calls the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await confirmProfileAction()).toEqual({ ok: false, message: "Your session has expired. Sign in again to confirm your Profile." });
    expect(profileClient.confirm).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("says the Profile could not be confirmed when the API refuses, and stays on the page", async () => {
    vi.mocked(profileClient.confirm).mockRejectedValue(new ProfileUnavailableError(404));

    expect(await confirmProfileAction()).toEqual({ ok: false, message: "We couldn't confirm your Profile. Try again in a moment." });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("readResumeAgainAction", () => {
  it("starts the reading with the Session and moves to the upload step, where its progress shows", async () => {
    vi.mocked(profileRecognitionClient.start).mockResolvedValue({ uploadedResumeId: "3f0f3c8e-5d0a-4a9b-9a53-2d4f5e6a7b8c" });

    await expect(readResumeAgainAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(profileRecognitionClient.start).toHaveBeenCalledWith("session-token");
    expect(revalidatePath).toHaveBeenCalledWith("/journey", "layout");
    expect(redirect).toHaveBeenCalledWith("/journey/resume");
  });

  it("asks to sign in again without a Session, and never calls the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await readResumeAgainAction()).toEqual({ ok: false, message: "Your session has expired. Sign in again to continue." });
    expect(profileRecognitionClient.start).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["model_key_missing", 409, "Your API key isn't stored anymore. Add it again on Choose your AI, then try again."],
    ["ingestion_active", 409, "Your résumé is already being read. Wait for it to finish, then try again."],
    ["curation_active", 409, "Your profile analysis is still running. Let it finish or stop it, then try again."],
    ["resume_text_missing", 404, "We no longer have the text of your résumé. Upload the PDF again instead."],
  ] as const)("says why in words when the API refuses with %s, and stays on the page", async (code, status, message) => {
    vi.mocked(profileRecognitionClient.start).mockRejectedValue(new ProfileRecognitionRefusedError(code, status));

    expect(await readResumeAgainAction()).toEqual({ ok: false, message });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("says the reading could not start when the API cannot be reached", async () => {
    vi.mocked(profileRecognitionClient.start).mockRejectedValue(new TypeError("fetch failed"));

    expect(await readResumeAgainAction()).toEqual({ ok: false, message: "We couldn't start reading your résumé again. Try again in a moment." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
