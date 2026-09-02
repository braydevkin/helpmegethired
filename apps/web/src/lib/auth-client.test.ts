import { describe, expect, it, vi } from "vitest";

import { AuthClient } from "./auth-client";

const credentials = { email: "ada@example.com", password: "correct horse battery" };
const account = {
  id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  email: credentials.email,
  createdAt: "2026-09-02T10:00:00.000Z",
};
const session = { token: "opaque-token", expiresAt: "2026-10-02T10:00:00.000Z" };

function clientAnswering(status: number, body?: unknown) {
  const fetchImplementation = vi.fn(() =>
    Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status })),
  );

  return { client: new AuthClient("http://api.test", fetchImplementation), fetchImplementation };
}

describe("AuthClient", () => {
  it("posts the credentials to sign up and returns the authenticated Account", async () => {
    const { client, fetchImplementation } = clientAnswering(201, { account, session });

    expect(await client.signUp(credentials)).toEqual({ ok: true, value: { account, session } });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/auth/sign-up",
      expect.objectContaining({ method: "POST", body: JSON.stringify(credentials) }),
    );
  });

  it("reports the API message for a rejected sign in", async () => {
    const { client } = clientAnswering(401, { statusCode: 401, message: "Invalid email or password" });

    expect(await client.signIn(credentials)).toEqual({
      ok: false,
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("joins the validation issues into one message", async () => {
    const { client } = clientAnswering(400, {
      statusCode: 400,
      message: "Validation failed",
      issues: [
        { path: "email", message: "Enter a valid email address" },
        { path: "password", message: "Password must have at least 8 characters" },
      ],
    });

    expect(await client.signUp(credentials)).toMatchObject({
      ok: false,
      message: "Enter a valid email address Password must have at least 8 characters",
    });
  });

  it("still fails cleanly when the error body is not readable", async () => {
    const { client } = clientAnswering(502);

    expect(await client.signUp(credentials)).toMatchObject({ ok: false, status: 502 });
  });

  it("sends the Session token as a bearer to read the current Account", async () => {
    const { client, fetchImplementation } = clientAnswering(200, account);

    expect(await client.currentAccount(session.token)).toEqual(account);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/auth/account",
      expect.objectContaining({ headers: { authorization: `Bearer ${session.token}` } }),
    );
  });

  it("answers undefined for a Session the API no longer accepts", async () => {
    const { client } = clientAnswering(401, { statusCode: 401, message: "A valid session is required" });

    expect(await client.currentAccount("stale")).toBeUndefined();
  });

  it("signs out with the bearer token", async () => {
    const { client, fetchImplementation } = clientAnswering(204);

    await client.signOut(session.token);

    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/auth/sign-out",
      expect.objectContaining({ method: "POST", headers: { authorization: `Bearer ${session.token}` } }),
    );
  });
});
