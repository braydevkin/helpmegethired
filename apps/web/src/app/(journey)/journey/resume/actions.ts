"use server";

import { ResumeUploadSchema, type ResumeUpload, type ResumeUploadReceipt, type UploadedResume } from "@helpmegethired/shared";

import { INGESTION_ACTIVE_MESSAGE, failureLeadOf } from "../../../../lib/resume-upload/progress";
import { ResumeRefusedError, resumeClient, type ResumeRead } from "../../../../lib/resume-client";
import { withSession, type ActionFailure, type ActionResult } from "../../../../lib/with-session";

export type ResumeActionResult<Value> = ActionResult<Value>;

const NOT_STARTED_MESSAGE = "We couldn't start the upload. Try again in a moment.";
const NOT_CONFIRMED_MESSAGE = "We couldn't confirm the upload. Try again in a moment.";
const NOT_READ_MESSAGE = "We lost track of the upload. Reload the page to see where it is.";

const failure = (message: string): ActionFailure => ({ ok: false, message });

// A refusal with a code has designed copy; anything else gets the step's own message.
const messageOf = (error: unknown, fallback: string): string => {
  if (error instanceof ResumeRefusedError && error.code) {
    return error.code === "ingestion_active" ? INGESTION_ACTIVE_MESSAGE : failureLeadOf(error.code);
  }

  return fallback;
};

const refusedWith =
  (fallback: string) =>
  (error: unknown): ActionFailure =>
    failure(messageOf(error, fallback));

export async function createResumeAction(upload: ResumeUpload): Promise<ResumeActionResult<ResumeUploadReceipt>> {
  const parsed = ResumeUploadSchema.safeParse(upload);

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? NOT_STARTED_MESSAGE);
  }

  return withSession((token) => resumeClient.requestUpload(token, parsed.data), refusedWith(NOT_STARTED_MESSAGE));
}

export async function completeResumeAction(id: string): Promise<ResumeActionResult<UploadedResume>> {
  return withSession((token) => resumeClient.complete(token, id), refusedWith(NOT_CONFIRMED_MESSAGE));
}

export async function readResumeAction(id: string, etag: string | undefined): Promise<ResumeActionResult<ResumeRead>> {
  return withSession((token) => resumeClient.read(token, id, etag), refusedWith(NOT_READ_MESSAGE));
}
