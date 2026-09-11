import { describe, expect, it, vi } from "vitest";

import { ModelChoiceRefusedError } from "./model-choice-refused-error";
import { sendModelKey } from "./model-key-sender";

const API = "http://api.public.test";
const TICKET = "t".repeat(43);
const KEY = "sk-ant-api03-a-key-nobody-should-see-again";
const request = { provider: "anthropic" as const, modelId: "claude-sonnet-5" as const, key: KEY };
const choice = { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("sendModelKey", () => {
  it("puts the choice and the key to the API with the ticket as its bearer, and no cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, choice));

    expect(await sendModelKey(API, TICKET, request, fetchMock)).toEqual(choice);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${API}/account/model`);
    expect(init).toMatchObject({ method: "PUT", credentials: "omit", headers: { authorization: `Bearer ${TICKET}`, "content-type": "application/json" } });
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("raises the refusal with its shared code and nothing of the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(422, { statusCode: 422, message: "The Provider does not accept this key", error: "Unprocessable Entity", code: "model_key_invalid" }),
    );

    const refusal = sendModelKey(API, TICKET, request, fetchMock);

    await expect(refusal).rejects.toEqual(new ModelChoiceRefusedError("model_key_invalid", 422));
    await expect(refusal).rejects.not.toHaveProperty("message", expect.stringContaining(KEY));
  });

  it("raises a refusal without a code when a proxy answers instead of the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(sendModelKey(API, TICKET, request, fetchMock)).rejects.toEqual(new ModelChoiceRefusedError(undefined, 502));
  });

  it("refuses an answer that carries anything besides whether a key is stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ...choice, key: KEY }));

    await expect(sendModelKey(API, TICKET, request, fetchMock)).rejects.toThrow();
  });
});
