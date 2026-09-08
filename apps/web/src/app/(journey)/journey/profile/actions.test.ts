import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileUnavailableError, profileClient } from "../../../../lib/profile-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { confirmProfileAction } from "./actions";

vi.mock("../../../../lib/profile-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/profile-client")>()),
  profileClient: { get: vi.fn(), confirm: vi.fn() },
}));
vi.mock("../../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSessionToken).mockResolvedValue("session-token");
});

describe("confirmProfileAction", () => {
  it("confirms with the Session", async () => {
    vi.mocked(profileClient.confirm).mockResolvedValue({} as never);

    expect(await confirmProfileAction()).toEqual({ ok: true });
    expect(profileClient.confirm).toHaveBeenCalledWith("session-token");
  });

  it("asks to sign in again without a Session, and never calls the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await confirmProfileAction()).toEqual({ ok: false, message: "Your session has expired. Sign in again to confirm your Profile." });
    expect(profileClient.confirm).not.toHaveBeenCalled();
  });

  it("says the Profile could not be confirmed when the API refuses", async () => {
    vi.mocked(profileClient.confirm).mockRejectedValue(new ProfileUnavailableError(404));

    expect(await confirmProfileAction()).toEqual({ ok: false, message: "We couldn't confirm your Profile. Try again in a moment." });
  });
});
