import { beforeEach, describe, expect, it, vi } from "vitest";

const readSessionToken = vi.fn();
const readPendingEmail = vi.fn();
const currentAccount = vi.fn();

vi.mock("../../../lib/session-cookie", () => ({ readSessionToken }));
vi.mock("../../../lib/pending-email-cookie", () => ({ readPendingEmail }));
vi.mock("../../../lib/auth-client", () => ({ authClient: { currentAccount } }));

const { signUpStart } = await import("./sign-up-start");

describe("signUpStart", () => {
  beforeEach(() => {
    readSessionToken.mockReset();
    readPendingEmail.mockReset();
    currentAccount.mockReset();
  });

  it("starts at the email step for a new visitor", async () => {
    readSessionToken.mockResolvedValue(undefined);
    readPendingEmail.mockResolvedValue(undefined);

    expect(await signUpStart()).toEqual({ step: "email" });
    expect(currentAccount).not.toHaveBeenCalled();
  });

  it("returns to the code step while a code is pending", async () => {
    readSessionToken.mockResolvedValue(undefined);
    readPendingEmail.mockResolvedValue({ email: "ada@example.com", sentAt: 1_000 });

    expect(await signUpStart()).toEqual({ step: "code", email: "ada@example.com", sentAt: 1_000 });
  });

  it("returns to the identity step once the code opened a Session", async () => {
    readSessionToken.mockResolvedValue("token");
    currentAccount.mockResolvedValue({ email: "ada@example.com", name: null });

    expect(await signUpStart()).toEqual({ step: "identity", email: "ada@example.com" });
    expect(readPendingEmail).not.toHaveBeenCalled();
  });

  it("falls back to the pending email when the Session is stale", async () => {
    readSessionToken.mockResolvedValue("stale");
    currentAccount.mockResolvedValue(undefined);
    readPendingEmail.mockResolvedValue(undefined);

    expect(await signUpStart()).toEqual({ step: "email" });
  });
});
