import { describe, expect, it, vi } from "vitest";

import { ModelChoiceClient } from "./model-choice-client";
import { ModelChoiceRefusedError } from "./model-choice-refused-error";

const token = "session-token";
const choice = { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true };
const ticket = { ticket: "t".repeat(43), expiresAt: "2026-09-11T12:01:00.000Z" };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const clientAnswering = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);

  return { client: new ModelChoiceClient("http://api.test", fetchMock), fetchMock };
};

describe("ModelChoiceClient", () => {
  it("reads the Model Choice with the Session", async () => {
    const { client, fetchMock } = clientAnswering(json(200, { choice }));

    expect(await client.read(token)).toEqual({ choice });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/account/model", expect.objectContaining({ method: "GET" }));
    expect(fetchMock.mock.calls[0]?.[1].headers).toEqual({ authorization: `Bearer ${token}` });
  });

  it("answers no choice for an Account that has not chosen yet", async () => {
    const { client } = clientAnswering(json(200, { choice: null }));

    expect(await client.read(token)).toEqual({ choice: null });
  });

  it("asks for a Model Key ticket with the Session", async () => {
    const { client, fetchMock } = clientAnswering(json(201, ticket));

    expect(await client.issueKeyTicket(token)).toEqual(ticket);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/account/model/key-ticket", expect.objectContaining({ method: "POST" }));
  });

  it("revokes the key and answers the choice that stays", async () => {
    const { client, fetchMock } = clientAnswering(json(200, { ...choice, keyStored: false }));

    expect(await client.revokeKey(token)).toEqual({ ...choice, keyStored: false });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/account/model/key", expect.objectContaining({ method: "DELETE" }));
  });

  it("raises the refusal with its shared code", async () => {
    const { client } = clientAnswering(json(404, { statusCode: 404, message: "The Account has no Model Choice yet", error: "Not Found" }));

    await expect(client.revokeKey(token)).rejects.toEqual(new ModelChoiceRefusedError(undefined, 404));
  });
});
