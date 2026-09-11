"use server";

import type { ModelKeyTicket } from "@helpmegethired/shared";

import type { ModelChoiceResult } from "../../../../components/organisms/model-choice-setup/model-choice-setup";
import { modelChoiceClient } from "../../../../lib/model-choice-client";
import { REVOKE_FAILED_MESSAGE, TICKET_FAILED_MESSAGE } from "../../../../lib/model-choice-messages";
import { withSession, type ActionFailure, type ActionResult } from "../../../../lib/with-session";

export type ModelChoiceActionResult<Value> = ActionResult<Value>;

const failedWith =
  (message: string) =>
  (): ActionFailure => ({ ok: false, message });

// Only the ticket crosses this boundary: the page presents it to send the key to the API itself.
export async function requestModelKeyTicketAction(): Promise<ModelChoiceActionResult<ModelKeyTicket>> {
  return withSession((token) => modelChoiceClient.issueKeyTicket(token), failedWith(TICKET_FAILED_MESSAGE));
}

export async function revokeModelKeyAction(): Promise<ModelChoiceResult> {
  const revoked = await withSession((token) => modelChoiceClient.revokeKey(token), failedWith(REVOKE_FAILED_MESSAGE));

  return revoked.ok ? { ok: true, choice: revoked.value } : revoked;
}
