"use server";

import type { ModelKeyTicket } from "@helpmegethired/shared";

import type { ModelChoiceResult } from "../../../../components/organisms/model-choice-setup/model-choice-setup";
import { modelChoiceClient } from "../../../../lib/model-choice-client";
import { REVOKE_FAILED_MESSAGE, SESSION_EXPIRED_MESSAGE, TICKET_FAILED_MESSAGE } from "../../../../lib/model-choice-messages";
import { readSessionToken } from "../../../../lib/session-cookie";

export type ModelChoiceActionResult<Value> = { ok: true; value: Value } | { ok: false; message: string };

async function withSession<Value>(work: (token: string) => Promise<Value>, fallback: string): Promise<ModelChoiceActionResult<Value>> {
  const token = await readSessionToken();

  if (!token) {
    return { ok: false, message: SESSION_EXPIRED_MESSAGE };
  }

  try {
    return { ok: true, value: await work(token) };
  } catch {
    return { ok: false, message: fallback };
  }
}

// Only the ticket crosses this boundary: the page presents it to send the key to the API itself.
export async function requestModelKeyTicketAction(): Promise<ModelChoiceActionResult<ModelKeyTicket>> {
  return withSession((token) => modelChoiceClient.issueKeyTicket(token), TICKET_FAILED_MESSAGE);
}

export async function revokeModelKeyAction(): Promise<ModelChoiceResult> {
  const revoked = await withSession((token) => modelChoiceClient.revokeKey(token), REVOKE_FAILED_MESSAGE);

  return revoked.ok ? { ok: true, choice: revoked.value } : revoked;
}
