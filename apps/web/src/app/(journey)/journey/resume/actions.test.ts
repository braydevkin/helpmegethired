import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeRefusedError, resumeClient } from "../../../../lib/resume-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { completeResumeAction, createResumeAction, readResumeAction } from "./actions";

vi.mock("../../../../lib/resume-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/resume-client")>()),
  resumeClient: { requestUpload: vi.fn(), complete: vi.fn(), read: vi.fn(), list: vi.fn() },
}));
vi.mock("../../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));

const upload = { fileName: "ada.pdf", sizeBytes: 1024, sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" };
const id = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSessionToken).mockResolvedValue("session-token");
});

describe("createResumeAction", () => {
  it("validates with the shared schema before calling the API", async () => {
    const result = await createResumeAction({ ...upload, fileName: "ada.png" });

    expect(result.ok).toBe(false);
    expect(resumeClient.requestUpload).not.toHaveBeenCalled();
  });

  it("answers the receipt with the Session", async () => {
    vi.mocked(resumeClient.requestUpload).mockResolvedValue({ resume: { id } as never, upload: null });

    expect(await createResumeAction(upload)).toEqual({ ok: true, value: { resume: { id }, upload: null } });
    expect(resumeClient.requestUpload).toHaveBeenCalledWith("session-token", upload);
  });

  it("asks to sign in again without a Session", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await createResumeAction(upload)).toEqual({ ok: false, message: "Your session has expired. Sign in again to continue." });
  });
});

describe("completeResumeAction", () => {
  it("turns the API's ingestion_active refusal into the designed copy", async () => {
    vi.mocked(resumeClient.complete).mockRejectedValue(new ResumeRefusedError("ingestion_active", 409));

    expect(await completeResumeAction(id)).toEqual({
      ok: false,
      message: "Your previous résumé is still being read. Wait for it to finish, then try again.",
    });
  });

  it("turns upload_incomplete into its lead and an unknown failure into the step's message", async () => {
    vi.mocked(resumeClient.complete).mockRejectedValueOnce(new ResumeRefusedError("upload_incomplete", 409)).mockRejectedValueOnce(new Error("down"));

    expect(await completeResumeAction(id)).toMatchObject({ ok: false, message: "The upload didn't finish. Check your connection and try again." });
    expect(await completeResumeAction(id)).toEqual({ ok: false, message: "We couldn't confirm the upload. Try again in a moment." });
  });
});

describe("readResumeAction", () => {
  it("passes the ETag through and answers what the client read", async () => {
    vi.mocked(resumeClient.read).mockResolvedValue({ changed: false });

    expect(await readResumeAction(id, '"abc"')).toEqual({ ok: true, value: { changed: false } });
    expect(resumeClient.read).toHaveBeenCalledWith("session-token", id, '"abc"');
  });
});
