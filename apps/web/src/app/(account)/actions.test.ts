import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyCode } from "../../auth/one-time-code";
import { JOURNEY_PATH } from "../paths";
import { oneTimeCodeAction, signInWithCodeAction } from "./actions";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../auth/one-time-code", () => ({ sendCode: vi.fn(), verifyCode: vi.fn() }));
vi.mock("../../lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("../../lib/session-cookie", () => ({ clearSession: vi.fn(), readSessionToken: vi.fn() }));

const request = { email: "ada@example.com", code: "482913" };
const notChecked = "We could not check your code. Try again in a moment.";

describe("signInWithCodeAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("continues to the journey when the code is accepted", async () => {
    vi.mocked(verifyCode).mockResolvedValue("session-token");

    await signInWithCodeAction(request);

    expect(redirect).toHaveBeenCalledWith(JOURNEY_PATH);
  });

  it("explains a rejected code", async () => {
    vi.mocked(verifyCode).mockResolvedValue(null);

    await expect(signInWithCodeAction(request)).resolves.toEqual({
      ok: false,
      message: "That code is not valid or has expired. Request a new one.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("reports that the code could not be checked instead of throwing", async () => {
    vi.mocked(verifyCode).mockRejectedValue(new Error("auth unavailable"));

    await expect(signInWithCodeAction(request)).resolves.toEqual({ ok: false, message: notChecked });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("oneTimeCodeAction", () => {
  it("stays on the code step with the message when the code could not be checked", async () => {
    vi.mocked(verifyCode).mockRejectedValue(new Error("auth unavailable"));

    await expect(
      oneTimeCodeAction({ step: "code", email: request.email }, { kind: "verify", request }),
    ).resolves.toEqual({ step: "code", email: request.email, message: notChecked });
  });
});
