import type { Account } from "@helpmegethired/shared";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "../../../lib/auth-client";
import { readSessionToken } from "../../../lib/session-cookie";
import { requireCandidate } from "./candidate";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirected"); }) }));
vi.mock("../../../lib/auth-client", () => ({ authClient: { currentAccount: vi.fn() } }));
vi.mock("../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));

const account: Account = {
  id: "3f1c2a6e-7b8d-4c9e-a0f1-2b3c4d5e6f70",
  email: "ada@example.com",
  name: "Ada",
  lastName: "Lovelace",
  phone: null,
  address: null,
  createdAt: "2026-09-04T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireCandidate", () => {
  it("answers the Account behind the Session with its initials and display name", async () => {
    vi.mocked(readSessionToken).mockResolvedValue("session-token");
    vi.mocked(authClient.currentAccount).mockResolvedValue(account);

    expect(await requireCandidate()).toEqual({ token: "session-token", account, initials: "AL", name: "Ada Lovelace" });
    expect(authClient.currentAccount).toHaveBeenCalledWith("session-token");
  });

  it("falls back to the e-mail as the display name when the Account has no name", async () => {
    vi.mocked(readSessionToken).mockResolvedValue("session-token");
    vi.mocked(authClient.currentAccount).mockResolvedValue({ ...account, name: null, lastName: null });

    expect(await requireCandidate()).toMatchObject({ initials: "?", name: "ada@example.com" });
  });

  it("redirects to sign in without a Session or when the API no longer accepts it", async () => {
    vi.mocked(readSessionToken).mockResolvedValueOnce(undefined).mockResolvedValueOnce("stale");
    vi.mocked(authClient.currentAccount).mockResolvedValue(undefined);

    await expect(requireCandidate()).rejects.toThrow("redirected");
    await expect(requireCandidate()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledTimes(2);
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
