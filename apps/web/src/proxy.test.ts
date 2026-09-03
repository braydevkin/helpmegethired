// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentAccount = vi.fn();

vi.mock("./lib/auth-client", () => ({ authClient: { currentAccount } }));

const { proxy } = await import("./proxy");

const account = {
  id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  email: "ada@example.com",
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+351", number: "912345678" },
  address: null,
  createdAt: "2026-09-02T10:00:00.000Z",
};
const namelessAccount = { ...account, name: null, lastName: null, phone: null };

const requestFor = (path: string, token?: string) =>
  new NextRequest(`http://web.test${path}`, { headers: token ? { cookie: `session=${token}` } : {} });

const clearedSession = { value: "", expires: new Date(0) };

describe("proxy", () => {
  beforeEach(() => currentAccount.mockReset());

  it("sends a visitor without a Session cookie from the journey to sign in", async () => {
    const response = await proxy(requestFor("/journey"));

    expect(response.headers.get("location")).toBe("http://web.test/sign-in");
    expect(currentAccount).not.toHaveBeenCalled();
  });

  it("leaves the forms alone for a visitor without a cookie", async () => {
    const response = await proxy(requestFor("/sign-in"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("session")).toBeUndefined();
    expect(currentAccount).not.toHaveBeenCalled();
  });

  it("lets a signed-in Candidate reach the journey", async () => {
    currentAccount.mockResolvedValue(account);

    const response = await proxy(requestFor("/journey", "token"));

    expect(response.headers.get("location")).toBeNull();
    expect(currentAccount).toHaveBeenCalledWith("token");
  });

  it("sends a signed-in Candidate from the forms to the journey", async () => {
    currentAccount.mockResolvedValue(account);

    const response = await proxy(requestFor("/sign-in", "token"));

    expect(response.headers.get("location")).toBe("http://web.test/journey");
  });

  it.each(["/journey", "/sign-in"])("sends an Account without a name from %s to the sign up step 3", async (path) => {
    currentAccount.mockResolvedValue(namelessAccount);

    const response = await proxy(requestFor(path, "token"));

    expect(response.headers.get("location")).toBe("http://web.test/sign-up");
  });

  it("lets an Account without a name stay on sign up", async () => {
    currentAccount.mockResolvedValue(namelessAccount);

    const response = await proxy(requestFor("/sign-up", "token"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("clears a stale Session cookie and shows the form", async () => {
    currentAccount.mockResolvedValue(undefined);

    const response = await proxy(requestFor("/sign-up", "stale"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("session")).toMatchObject(clearedSession);
  });

  it("clears a stale Session cookie and sends the journey to sign in", async () => {
    currentAccount.mockResolvedValue(undefined);

    const response = await proxy(requestFor("/journey", "stale"));

    expect(response.headers.get("location")).toBe("http://web.test/sign-in");
    expect(response.cookies.get("session")).toMatchObject(clearedSession);
  });
});
