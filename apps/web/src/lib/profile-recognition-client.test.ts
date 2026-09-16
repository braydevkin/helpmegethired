import { describe, expect, it, vi } from "vitest";

import { ProfileRecognitionClient, ProfileRecognitionRefusedError } from "./profile-recognition-client";

const token = "session-token";
const receipt = { uploadedResumeId: "3f0f3c8e-5d0a-4a9b-9a53-2d4f5e6a7b8c" };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ProfileRecognitionClient", () => {
  it("posts with the Session and answers the Uploaded Resume read again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(202, receipt));
    const client = new ProfileRecognitionClient("http://api.test", fetchMock);

    expect(await client.start(token)).toEqual(receipt);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/profile/recognition", expect.objectContaining({ method: "POST", cache: "no-store" }));
    expect(fetchMock.mock.calls[0]?.[1].headers).toEqual({ authorization: `Bearer ${token}` });
  });

  it.each([
    [409, "model_key_missing"],
    [409, "ingestion_active"],
    [409, "curation_active"],
    [404, "resume_text_missing"],
  ] as const)("raises the API's code when it answers %i %s", async (status, code) => {
    const client = new ProfileRecognitionClient("http://api.test", vi.fn().mockResolvedValue(json(status, { statusCode: status, message: "refused", code })));

    await expect(client.start(token)).rejects.toMatchObject({ name: "ProfileRecognitionRefusedError", code, status });
  });

  it("raises the status alone for a code it does not know or a body that is not JSON", async () => {
    const unknown = new ProfileRecognitionClient("http://api.test", vi.fn().mockResolvedValue(json(409, { statusCode: 409, message: "refused", code: "upload_incomplete" })));
    const broken = new ProfileRecognitionClient("http://api.test", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));

    await expect(unknown.start(token)).rejects.toMatchObject({ code: undefined, status: 409 });
    await expect(broken.start(token)).rejects.toBeInstanceOf(ProfileRecognitionRefusedError);
    await expect(broken.start(token)).rejects.toMatchObject({ code: undefined, status: 502 });
  });

  it("refuses an answer that breaks the shared contract", async () => {
    const client = new ProfileRecognitionClient("http://api.test", vi.fn().mockResolvedValue(json(202, { uploadedResumeId: "resume-1" })));

    await expect(client.start(token)).rejects.toThrow();
  });
});
