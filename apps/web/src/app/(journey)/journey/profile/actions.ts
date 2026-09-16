"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ConfirmResult } from "../../../../components/molecules/profile-actions/profile-actions";
import { recognitionRefusalMessageOf } from "../../../../lib/profile/recognition-refusal";
import { profileClient } from "../../../../lib/profile-client";
import { profileRecognitionClient } from "../../../../lib/profile-recognition-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { withSession, type ActionFailure } from "../../../../lib/with-session";
import { ANALYSIS_PATH, JOURNEY_PATH, RESUME_STEP_PATH } from "../../../paths";

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
  redirect(ANALYSIS_PATH);
}

// The upload step already follows an Uploaded Resume while it is processing, so the reading is
// watched there.
export async function readResumeAgainAction(): Promise<ActionFailure> {
  const started = await withSession((token) => profileRecognitionClient.start(token), (error): ActionFailure => ({ ok: false, message: recognitionRefusalMessageOf(error) }));

  if (!started.ok) {
    return started;
  }

  revalidatePath(JOURNEY_PATH, "layout");
  redirect(RESUME_STEP_PATH);
}
