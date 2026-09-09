"use server";

import { revalidatePath } from "next/cache";

import type { ConfirmResult } from "../../../../components/molecules/profile-actions/profile-actions";
import { profileClient } from "../../../../lib/profile-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { JOURNEY_PATH } from "../../../paths";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to confirm your Profile.";
const NOT_CONFIRMED_MESSAGE = "We couldn't confirm your Profile. Try again in a moment.";

export async function confirmProfileAction(): Promise<ConfirmResult> {
  const token = await readSessionToken();

  if (!token) {
    return { ok: false, message: SESSION_EXPIRED_MESSAGE };
  }

  try {
    await profileClient.confirm(token);
  } catch {
    return { ok: false, message: NOT_CONFIRMED_MESSAGE };
  }

  revalidatePath(JOURNEY_PATH, "layout");

  return { ok: true };
}
