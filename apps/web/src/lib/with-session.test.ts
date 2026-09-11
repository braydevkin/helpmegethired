import { beforeEach, describe, expect, it, vi } from "vitest";

import { readSessionToken } from "./session-cookie";
import { SESSION_EXPIRED_MESSAGE, withSession } from "./with-session";

vi.mock("./session-cookie", () => ({ readSessionToken: vi.fn() }));

const refusalOf = (error: unknown) => ({ ok: false as const, message: error instanceof Error ? error.message : "refused", code: "curation_active" as const });

describe("withSession", () => {
  beforeEach(() => {
    vi.mocked(readSessionToken).mockReset();
  });

  it("answers the call's value, made with the Candidate's session token", async () => {
    vi.mocked(readSessionToken).mockResolvedValue("session-token");
    const work = vi.fn().mockResolvedValue({ percentage: 40 });

    expect(await withSession(work, refusalOf)).toEqual({ ok: true, value: { percentage: 40 } });
    expect(work).toHaveBeenCalledWith("session-token");
  });

  it("asks the Candidate to sign in again, without calling the API, when there is no session", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);
    const work = vi.fn();

    expect(await withSession(work, refusalOf)).toEqual({ ok: false, message: SESSION_EXPIRED_MESSAGE });
    expect(work).not.toHaveBeenCalled();
  });

  it("hands a refused call to the action's own mapping", async () => {
    vi.mocked(readSessionToken).mockResolvedValue("session-token");

    expect(await withSession(() => Promise.reject(new Error("busy")), refusalOf)).toEqual({ ok: false, message: "busy", code: "curation_active" });
  });
});
