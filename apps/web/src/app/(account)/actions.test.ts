import type { Account } from "@helpmegethired/shared";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyCode } from "../../auth/one-time-code";
import { authClient } from "../../lib/auth-client";
import { readSessionToken } from "../../lib/session-cookie";
import { JOURNEY_PATH, SIGN_UP_PATH } from "../paths";
import {
  saveAccountInformationAction,
  signInWithCodeAction,
  verifyCodeAction,
  type AccountInformationRequest,
} from "./actions";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../auth/one-time-code", () => ({ sendCode: vi.fn(), verifyCode: vi.fn() }));
vi.mock("../../lib/auth-client", () => ({
  authClient: { currentAccount: vi.fn(), updateAccount: vi.fn(), signOut: vi.fn() },
}));
vi.mock("../../lib/pending-email-cookie", () => ({ forgetPendingEmail: vi.fn(), rememberPendingEmail: vi.fn() }));
vi.mock("../../lib/session-cookie", () => ({ clearSession: vi.fn(), readSessionToken: vi.fn() }));

const request = { email: "ada@example.com", code: "482913" };
const account: Account = {
  id: "3f1c2a6e-7b8d-4c9e-a0f1-2b3c4d5e6f70",
  email: request.email,
  name: "Ada",
  lastName: "Lovelace",
  phone: null,
  address: null,
  createdAt: "2026-09-04T10:00:00.000Z",
};
const information: AccountInformationRequest = {
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+351", number: "912345678" },
  address: null,
};
const notChecked = "We could not check your code. Try again in a moment.";
const notSaved = "We could not save your details. Check them and try again.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyCodeAction", () => {
  it("accepts a verified code", async () => {
    vi.mocked(verifyCode).mockResolvedValue("session-token");

    await expect(verifyCodeAction(request)).resolves.toEqual({ ok: true });
  });

  it("explains a rejected code", async () => {
    vi.mocked(verifyCode).mockResolvedValue(null);

    await expect(verifyCodeAction(request)).resolves.toEqual({
      ok: false,
      message: "That code is not valid or has expired. Request a new one.",
    });
  });

  it("reports that the code could not be checked instead of throwing", async () => {
    vi.mocked(verifyCode).mockRejectedValue(new Error("auth unavailable"));

    await expect(verifyCodeAction(request)).resolves.toEqual({ ok: false, message: notChecked });
  });
});

describe("signInWithCodeAction", () => {
  beforeEach(() => {
    vi.mocked(verifyCode).mockResolvedValue("session-token");
  });

  it("continues to the journey when the Account has a name", async () => {
    vi.mocked(authClient.currentAccount).mockResolvedValue(account);

    await signInWithCodeAction(request);

    expect(redirect).toHaveBeenCalledWith(JOURNEY_PATH);
  });

  it("continues to sign up when the Account has no name yet", async () => {
    vi.mocked(authClient.currentAccount).mockResolvedValue({ ...account, name: null });

    await signInWithCodeAction(request);

    expect(redirect).toHaveBeenCalledWith(SIGN_UP_PATH);
  });

  it("continues to the journey when the Account lookup fails", async () => {
    vi.mocked(authClient.currentAccount).mockRejectedValue(new Error("api unavailable"));

    await signInWithCodeAction(request);

    expect(redirect).toHaveBeenCalledWith(JOURNEY_PATH);
  });

  it("does not redirect when the code could not be checked", async () => {
    vi.mocked(verifyCode).mockRejectedValue(new Error("auth unavailable"));

    await expect(signInWithCodeAction(request)).resolves.toEqual({ ok: false, message: notChecked });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("saveAccountInformationAction", () => {
  beforeEach(() => {
    vi.mocked(readSessionToken).mockResolvedValue("session-token");
  });

  it("saves valid information", async () => {
    vi.mocked(authClient.updateAccount).mockResolvedValue(account);

    await expect(saveAccountInformationAction(information)).resolves.toEqual({ ok: true });
  });

  it("reports that the details could not be saved instead of throwing", async () => {
    vi.mocked(authClient.updateAccount).mockRejectedValue(new Error("api unavailable"));

    await expect(saveAccountInformationAction(information)).resolves.toEqual({ ok: false, message: notSaved });
  });
});
