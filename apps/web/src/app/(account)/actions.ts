"use server";

import type { AuthenticatedAccount, Credentials } from "@helpmegethired/shared";
import { redirect } from "next/navigation";

import { authClient, type ApiResult } from "../../lib/auth-client";
import { clearSession, readSessionToken, storeSession } from "../../lib/session-cookie";
import { JOURNEY_PATH, SIGN_IN_PATH } from "../paths";

export type CredentialsFormState = { ok: true } | { ok: false; message: string };

async function openSession(result: ApiResult<AuthenticatedAccount>): Promise<CredentialsFormState> {
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await storeSession(result.value.session);
  redirect(JOURNEY_PATH);
}

export async function signUpAction(
  _previous: CredentialsFormState,
  credentials: Credentials,
): Promise<CredentialsFormState> {
  return openSession(await authClient.signUp(credentials));
}

export async function signInAction(
  _previous: CredentialsFormState,
  credentials: Credentials,
): Promise<CredentialsFormState> {
  return openSession(await authClient.signIn(credentials));
}

export async function signOutAction(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    await authClient.signOut(token);
  }

  await clearSession();
  redirect(SIGN_IN_PATH);
}
