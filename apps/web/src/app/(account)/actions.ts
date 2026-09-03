"use server";

import {
  AccountInformationSchema,
  SendCodeSchema,
  VerifyCodeSchema,
  type SendCodeRequest,
  type VerifyCodeRequest,
} from "@helpmegethired/shared";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { sendCode, verifyCode } from "../../auth/one-time-code";
import { authClient } from "../../lib/auth-client";
import { forgetPendingEmail, rememberPendingEmail } from "../../lib/pending-email-cookie";
import { clearSession, readSessionToken } from "../../lib/session-cookie";
import { JOURNEY_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "../paths";

export type ActionResult = { ok: true } | { ok: false; message: string };

export type AccountInformationRequest = z.input<typeof AccountInformationSchema>;

const CODE_NOT_SENT_MESSAGE = "We could not send your code. Try again in a moment.";
const CODE_REJECTED_MESSAGE = "That code is not valid or has expired. Request a new one.";
const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to continue.";
const INFORMATION_NOT_SAVED_MESSAGE = "We could not save your details. Check them and try again.";

const firstMessage = (issues: { message: string }[]) => issues[0]?.message ?? "Check the form and try again.";

const failure = (message: string): ActionResult => ({ ok: false, message });

export async function sendCodeAction(request: SendCodeRequest): Promise<ActionResult> {
  const parsed = SendCodeSchema.safeParse(request);

  if (!parsed.success) {
    return failure(firstMessage(parsed.error.issues));
  }

  try {
    await sendCode(parsed.data.email);
  } catch {
    return failure(CODE_NOT_SENT_MESSAGE);
  }

  await rememberPendingEmail(parsed.data.email);

  return { ok: true };
}

async function verifyParsedCode(request: VerifyCodeRequest): Promise<{ token: string } | { message: string }> {
  const parsed = VerifyCodeSchema.safeParse(request);

  if (!parsed.success) {
    return { message: firstMessage(parsed.error.issues) };
  }

  const token = await verifyCode(parsed.data);

  if (!token) {
    return { message: CODE_REJECTED_MESSAGE };
  }

  await forgetPendingEmail();

  return { token };
}

export async function verifyCodeAction(request: VerifyCodeRequest): Promise<ActionResult> {
  const outcome = await verifyParsedCode(request);

  return "token" in outcome ? { ok: true } : failure(outcome.message);
}

// A verified code is the sign in. An Account that has not given its name yet
// continues to the account information step instead of the journey (design open point 8).
export async function signInWithCodeAction(request: VerifyCodeRequest): Promise<ActionResult> {
  const outcome = await verifyParsedCode(request);

  if ("message" in outcome) {
    return failure(outcome.message);
  }

  const account = await authClient.currentAccount(outcome.token);

  redirect(account?.name ? JOURNEY_PATH : SIGN_UP_PATH);
}

export async function saveAccountInformationAction(request: AccountInformationRequest): Promise<ActionResult> {
  const parsed = AccountInformationSchema.safeParse(request);

  if (!parsed.success) {
    return failure(firstMessage(parsed.error.issues));
  }

  const token = await readSessionToken();

  if (!token) {
    return failure(SESSION_EXPIRED_MESSAGE);
  }

  const account = await authClient.updateAccount(token, parsed.data);

  return account ? { ok: true } : failure(INFORMATION_NOT_SAVED_MESSAGE);
}

export async function signOutAction(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    await authClient.signOut(token);
  }

  await clearSession();
  redirect(SIGN_IN_PATH);
}
