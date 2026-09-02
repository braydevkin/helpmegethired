// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentAccount = vi.fn();

vi.mock("./lib/auth-client", () => ({ authClient: { currentAccount } }));

const { proxy } = await import("./proxy");

const requestFor = (path: string, token?: string) =>
  new NextRequest(`http://web.test${path}`, { headers: token ? { cookie: `session=${token}` } : {} });

describe("proxy", () => {
  beforeEach(() => currentAccount.mockReset());

  it("sends a visitor without a Session cookie from the journey to sign in", async () => {
    const response = await proxy(requestFor("/journey"));

    expect(response.headers.get("location")).toBe("http://web.test/sign-in");
    expect(currentAccount).not.toHaveBeenCalled();
  });

  it("lets a visitor with a Session cookie reach the journey without calling the API", async () => {
    const response = await proxy(requestFor("/journey", "token"));

    expect(response.headers.get("location")).toBeNull();
    expect(currentAccount).not.toHaveBeenCalled();
  });

  it("sends a signed-in Candidate from the forms to the journey", async () => {
    currentAccount.mockResolvedValue({
      id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
      email: "ada@example.com",
      createdAt: "2026-09-02T10:00:00.000Z",
    });

    const response = await proxy(requestFor("/sign-in", "token"));

    expect(response.headers.get("location")).toBe("http://web.test/journey");
  });

  it("clears a stale Session cookie and shows the form", async () => {
    currentAccount.mockResolvedValue(undefined);

    const response = await proxy(requestFor("/sign-up", "stale"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("session")).toMatchObject({ value: "", expires: new Date(0) });
  });

  it("leaves the forms alone for a visitor without a cookie", async () => {
    const response = await proxy(requestFor("/sign-in"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("session")).toBeUndefined();
  });
});
