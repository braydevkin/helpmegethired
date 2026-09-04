"use server";

import { SendCodeSchema, VerifyCodeSchema, type SendCodeRequest, type VerifyCodeRequest } from "@helpmegethired/shared";
import { redirect } from "next/navigation";

import { sendCode, verifyCode } from "../../auth/one-time-code";
import { authClient } from "../../lib/auth-client";
import { clearSession, readSessionToken } from "../../lib/session-cookie";
import { JOURNEY_PATH, SIGN_IN_PATH } from "../paths";

export type OneTimeCodeFormInput =
  | { kind: "send"; request: SendCodeRequest }
  | { kind: "verify"; request: VerifyCodeRequest }
  | { kind: "change-email" };

export type OneTimeCodeFormState =
  | { step: "email"; message?: string }
  | { step: "code"; email: string; message?: string };

const CODE_NOT_SENT_MESSAGE = "We could not send your code. Try again in a moment.";
const CODE_REJECTED_MESSAGE = "That code is not valid or has expired. Request a new one.";

const firstMessage = (issues: { message: string }[]) => issues[0]?.message ?? "Check the form and try again.";

async function send(request: SendCodeRequest): Promise<OneTimeCodeFormState> {
  const parsed = SendCodeSchema.safeParse(request);

  if (!parsed.success) {
    return { step: "email", message: firstMessage(parsed.error.issues) };
  }

  try {
    await sendCode(parsed.data.email);
  } catch {
    return { step: "email", message: CODE_NOT_SENT_MESSAGE };
  }

  return { step: "code", email: parsed.data.email };
}

async function verify(request: VerifyCodeRequest): Promise<OneTimeCodeFormState> {
  const parsed = VerifyCodeSchema.safeParse(request);

  if (!parsed.success) {
    return { step: "code", email: request.email, message: firstMessage(parsed.error.issues) };
  }

  if (!(await verifyCode(parsed.data))) {
    return { step: "code", email: parsed.data.email, message: CODE_REJECTED_MESSAGE };
  }

  redirect(JOURNEY_PATH);
}

export async function oneTimeCodeAction(
  _previous: OneTimeCodeFormState,
  input: OneTimeCodeFormInput,
): Promise<OneTimeCodeFormState> {
  switch (input.kind) {
    case "send":
      return send(input.request);
    case "verify":
      return verify(input.request);
    case "change-email":
      return { step: "email" };
  }
}

export async function signOutAction(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    await authClient.signOut(token);
  }

  await clearSession();
  redirect(SIGN_IN_PATH);
}
