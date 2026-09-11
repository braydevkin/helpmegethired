"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ConfirmResult } from "../../../../components/molecules/profile-actions/profile-actions";
import {
  basicProfileFrom,
  entryIdFrom,
  experienceFrom,
  type CorrectionFailure,
  type CorrectionResult,
  type FormReading,
} from "../../../../lib/profile/correction-form";
import { ProfileCorrectionRejectedError, ProfileUnavailableError, profileClient } from "../../../../lib/profile-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { withSession } from "../../../../lib/with-session";
import { ANALYSIS_PATH, JOURNEY_PATH } from "../../../paths";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to confirm your Profile.";
const NOT_CONFIRMED_MESSAGE = "We couldn't confirm your Profile. Try again in a moment.";
const NOT_SAVED_MESSAGE = "We couldn't save your correction. Try again in a moment.";
const CONFIRMED_MESSAGE = "Your Profile is confirmed, so it takes no more corrections.";
const CONFLICT = 409;

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

export async function correctBasicProfileAction(_previous: CorrectionResult | null, form: FormData): Promise<CorrectionResult> {
  return saved(basicProfileFrom(form), (token, basicProfile) => profileClient.correctBasicProfile(token, basicProfile));
}

// The same form saves a correction and a role the résumé never held: the id says which.
export async function saveExperienceAction(_previous: CorrectionResult | null, form: FormData): Promise<CorrectionResult> {
  const entryId = entryIdFrom(form);

  return saved(experienceFrom(form), (token, experience) =>
    entryId === null ? profileClient.addEntry(token, "experiences", experience) : profileClient.correctEntry(token, "experiences", entryId, experience),
  );
}

export async function removeExperienceAction(entryId: string): Promise<CorrectionResult> {
  return written((token) => profileClient.removeEntry(token, "experiences", entryId));
}

// A correction the page can already tell is wrong never reaches the API, and what the API
// refuses comes back on the field it belongs to.
async function saved<Value>(reading: FormReading<Value>, write: (token: string, value: Value) => Promise<unknown>): Promise<CorrectionResult> {
  if (!reading.ok) {
    return { ok: false, message: NOT_SAVED_MESSAGE, issues: reading.issues };
  }

  return written((token) => write(token, reading.value));
}

async function written(write: (token: string) => Promise<unknown>): Promise<CorrectionResult> {
  const result = await withSession(write, refusal);

  if (!result.ok) {
    return result;
  }

  revalidatePath(JOURNEY_PATH, "layout");

  return { ok: true };
}

const refusal = (error: unknown): CorrectionFailure => {
  if (error instanceof ProfileCorrectionRejectedError) {
    return { ok: false, message: NOT_SAVED_MESSAGE, issues: error.issues };
  }

  const confirmed = error instanceof ProfileUnavailableError && error.status === CONFLICT;

  return { ok: false, message: confirmed ? CONFIRMED_MESSAGE : NOT_SAVED_MESSAGE };
};
