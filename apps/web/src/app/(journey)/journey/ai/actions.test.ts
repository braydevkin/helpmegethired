import { beforeEach, describe, expect, it, vi } from "vitest";

import { modelChoiceClient } from "../../../../lib/model-choice-client";
import { REVOKE_FAILED_MESSAGE, TICKET_FAILED_MESSAGE } from "../../../../lib/model-choice-messages";
import { ModelChoiceRefusedError } from "../../../../lib/model-choice-refused-error";
import { readSessionToken } from "../../../../lib/session-cookie";
import { SESSION_EXPIRED_MESSAGE } from "../../../../lib/with-session";
import { requestModelKeyTicketAction, revokeModelKeyAction } from "./actions";

vi.mock("../../../../lib/model-choice-client", () => ({ modelChoiceClient: { read: vi.fn(), issueKeyTicket: vi.fn(), revokeKey: vi.fn() } }));
vi.mock("../../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));

const ticket = { ticket: "t".repeat(43), expiresAt: "2026-09-11T12:01:00.000Z" };
const revoked = { provider: "anthropic" as const, modelId: "claude-sonnet-5" as const, keyStored: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSessionToken).mockResolvedValue("session-token");
});

describe("requestModelKeyTicketAction", () => {
  it("asks for a ticket with the Session", async () => {
    vi.mocked(modelChoiceClient.issueKeyTicket).mockResolvedValue(ticket);

    expect(await requestModelKeyTicketAction()).toEqual({ ok: true, value: ticket });
    expect(modelChoiceClient.issueKeyTicket).toHaveBeenCalledWith("session-token");
  });

  it("asks to sign in again without a Session, and never calls the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await requestModelKeyTicketAction()).toEqual({ ok: false, message: SESSION_EXPIRED_MESSAGE });
    expect(modelChoiceClient.issueKeyTicket).not.toHaveBeenCalled();
  });

  it("says saving could not start when the API refuses", async () => {
    vi.mocked(modelChoiceClient.issueKeyTicket).mockRejectedValue(new ModelChoiceRefusedError(undefined, 500));

    expect(await requestModelKeyTicketAction()).toEqual({ ok: false, message: TICKET_FAILED_MESSAGE });
  });
});

describe("revokeModelKeyAction", () => {
  it("revokes with the Session and answers the choice that stays", async () => {
    vi.mocked(modelChoiceClient.revokeKey).mockResolvedValue(revoked);

    expect(await revokeModelKeyAction()).toEqual({ ok: true, choice: revoked });
    expect(modelChoiceClient.revokeKey).toHaveBeenCalledWith("session-token");
  });

  it("says the key could not be revoked when the API refuses", async () => {
    vi.mocked(modelChoiceClient.revokeKey).mockRejectedValue(new ModelChoiceRefusedError(undefined, 404));

    expect(await revokeModelKeyAction()).toEqual({ ok: false, message: REVOKE_FAILED_MESSAGE });
  });

  it("asks to sign in again without a Session", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await revokeModelKeyAction()).toEqual({ ok: false, message: SESSION_EXPIRED_MESSAGE });
    expect(modelChoiceClient.revokeKey).not.toHaveBeenCalled();
  });
});
