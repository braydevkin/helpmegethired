import { describe, expect, it, vi } from "vitest";

import { ResumeClient, ResumeRefusedError } from "./resume-client";

const token = "session-token";
const resume = {
  id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  accountId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  createdAt: "2026-09-08T10:00:00.000Z",
  source: "upload",
  fileName: "ada.pdf",
  contentType: "application/pdf",
  sizeBytes: 1024,
  sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  status: "processing",
  errorCode: null,
  finishedAt: null,
  progress: null,
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("ResumeClient", () => {
  it("sends the upload with the Session and parses the receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { resume: { ...resume, status: "pending" }, upload: null }));
    const client = new ResumeClient("http://api.test", fetchMock);
    const upload = { fileName: "ada.pdf", sizeBytes: 1024, sha256: resume.sha256 };

    const receipt = await client.requestUpload(token, upload);

    expect(receipt.resume.status).toBe("pending");
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/resumes", expect.objectContaining({ method: "POST", body: JSON.stringify(upload) }));
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({ authorization: `Bearer ${token}`, "content-type": "application/json" });
  });

  it("answers unchanged on 304 and the record with its ETag otherwise", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 304 })).mockResolvedValueOnce(json(200, resume, { etag: '"abc"' }));
    const client = new ResumeClient("http://api.test", fetchMock);

    expect(await client.read(token, resume.id, '"abc"')).toEqual({ changed: false });
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({ "if-none-match": '"abc"' });
    expect(await client.read(token, resume.id, undefined)).toEqual({ changed: true, resume, etag: '"abc"' });
  });

  it("raises the API's code when it refuses", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(409, { statusCode: 409, message: "busy", error: "Conflict", code: "ingestion_active" })));
    const client = new ResumeClient("http://api.test", fetchMock);

    await expect(client.complete(token, resume.id)).rejects.toMatchObject({ name: "ResumeRefusedError", code: "ingestion_active", status: 409 });
    await expect(client.complete(token, resume.id)).rejects.toBeInstanceOf(ResumeRefusedError);
  });

  it("refuses with the status alone when the body is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } }));
    const client = new ResumeClient("http://api.test", fetchMock);

    await expect(client.list(token)).rejects.toMatchObject({ name: "ResumeRefusedError", code: undefined, status: 502 });
  });

  it("lists the Account's records", async () => {
    const client = new ResumeClient("http://api.test", vi.fn().mockResolvedValue(json(200, [resume])));

    expect(await client.list(token)).toEqual([resume]);
  });
});
