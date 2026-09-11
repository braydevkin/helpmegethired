import { describe, expect, it, vi } from "vitest";

import { CurationClient, CurationRefusedError } from "./curation-client";
import { progressOf, unitsOf } from "./curation-progress/curation-progress.fixtures";

const token = "session-token";
const state = { progress: progressOf(unitsOf(3, 1)) };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("CurationClient", () => {
  it("reads the progress with the Session and returns it with its ETag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, state, { etag: '"abc"' }));
    const client = new CurationClient("http://api.test", fetchMock);

    expect(await client.read(token, undefined)).toEqual({ changed: true, state, etag: '"abc"' });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/profile/curation", expect.objectContaining({ method: "GET", cache: "no-store" }));
    expect(fetchMock.mock.calls[0]?.[1].headers).toEqual({ authorization: `Bearer ${token}` });
  });

  it("sends the last ETag and answers unchanged on 304", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    const client = new CurationClient("http://api.test", fetchMock);

    expect(await client.read(token, '"abc"')).toEqual({ changed: false });
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({ "if-none-match": '"abc"' });
  });

  it("reads an Account with no Curation as no progress", async () => {
    const client = new CurationClient("http://api.test", vi.fn().mockResolvedValue(json(200, { progress: null })));

    expect(await client.read(token, undefined)).toEqual({ changed: true, state: { progress: null }, etag: undefined });
  });

  it("raises the API's code when it refuses, and the status alone for a body that is not JSON", async () => {
    const refused = new CurationClient("http://api.test", vi.fn().mockResolvedValue(json(404, { statusCode: 404, message: "none", error: "Not Found", code: "curation_not_found" })));
    const broken = new CurationClient("http://api.test", vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })));

    await expect(refused.read(token, undefined)).rejects.toMatchObject({ name: "CurationRefusedError", code: "curation_not_found", status: 404 });
    await expect(broken.read(token, undefined)).rejects.toBeInstanceOf(CurationRefusedError);
    await expect(broken.read(token, undefined)).rejects.toMatchObject({ code: undefined, status: 502 });
  });

  it("refuses a payload that breaks the shared contract", async () => {
    const client = new CurationClient("http://api.test", vi.fn().mockResolvedValue(json(200, { progress: { status: "running" } })));

    await expect(client.read(token, undefined)).rejects.toThrow();
  });
});
