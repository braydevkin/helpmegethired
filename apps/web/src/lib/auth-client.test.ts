import { describe, expect, it, vi } from "vitest";

import { AuthClient } from "./auth-client";

const account = {
  id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  email: "ada@example.com",
  name: null,
  lastName: null,
  phone: null,
  address: null,
  createdAt: "2026-09-02T10:00:00.000Z",
};
const token = "opaque-token";

function clientAnswering(status: number, body?: unknown) {
  const fetchImplementation = vi.fn(() =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );

  return { client: new AuthClient("http://api.test", fetchImplementation), fetchImplementation };
}

describe("AuthClient", () => {
  it("sends the Session token as a bearer to read the current Account", async () => {
    const { client, fetchImplementation } = clientAnswering(200, account);

    expect(await client.currentAccount(token)).toEqual(account);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/auth/account",
      expect.objectContaining({ headers: { authorization: `Bearer ${token}` } }),
    );
  });

  it("answers undefined for a Session the API no longer accepts", async () => {
    const { client } = clientAnswering(401, { statusCode: 401, message: "A valid session is required" });

    expect(await client.currentAccount("stale")).toBeUndefined();
  });

  it("signs out with the bearer token", async () => {
    const { client, fetchImplementation } = clientAnswering(204);

    await client.signOut(token);

    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/auth/sign-out",
      expect.objectContaining({ method: "POST", headers: { authorization: `Bearer ${token}` } }),
    );
  });

  it("saves the Account information with a JSON body and answers the updated Account", async () => {
    const information = { name: "Ada", lastName: "Lovelace", phone: { countryCode: "+44" as const, number: "7700900123" }, address: null };
    const { client, fetchImplementation } = clientAnswering(200, { ...account, ...information });

    expect(await client.updateAccount(token, information)).toMatchObject(information);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/auth/account",
      expect.objectContaining({
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(information),
      }),
    );
  });

  it("answers undefined when the API refuses the Account information", async () => {
    const { client } = clientAnswering(400, { statusCode: 400, message: "Name is required" });

    expect(
      await client.updateAccount(token, { name: "", lastName: "", phone: { countryCode: "+351" as const, number: "1" }, address: null }),
    ).toBeUndefined();
  });
});
