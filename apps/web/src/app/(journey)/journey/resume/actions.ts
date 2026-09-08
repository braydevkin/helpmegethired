"use server";

import { ResumeUploadSchema, type ResumeUpload, type ResumeUploadReceipt, type UploadedResume } from "@helpmegethired/shared";

import { INGESTION_ACTIVE_MESSAGE, failureLeadOf } from "../../../../lib/resume-upload/progress";
import { ResumeRefusedError, resumeClient, type ResumeRead } from "../../../../lib/resume-client";
import { readSessionToken } from "../../../../lib/session-cookie";

export type ResumeActionResult<Value> = { ok: true; value: Value } | { ok: false; message: string };

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to continue.";
const NOT_STARTED_MESSAGE = "We couldn't start the upload. Try again in a moment.";
const NOT_CONFIRMED_MESSAGE = "We couldn't confirm the upload. Try again in a moment.";
const NOT_READ_MESSAGE = "We lost track of the upload. Reload the page to see where it is.";

const failure = <Value>(message: string): ResumeActionResult<Value> => ({ ok: false, message });

// A refusal with a code has designed copy; anything else gets the step's own message.
const messageOf = (error: unknown, fallback: string): string => {
  if (error instanceof ResumeRefusedError && error.code) {
    return error.code === "ingestion_active" ? INGESTION_ACTIVE_MESSAGE : failureLeadOf(error.code);
  }

  return fallback;
};

async function withSession<Value>(work: (token: string) => Promise<Value>, fallback: string): Promise<ResumeActionResult<Value>> {
  const token = await readSessionToken();

  if (!token) {
    return failure(SESSION_EXPIRED_MESSAGE);
  }

  try {
    return { ok: true, value: await work(token) };
  } catch (error) {
    return failure(messageOf(error, fallback));
  }
}

export async function createResumeAction(upload: ResumeUpload): Promise<ResumeActionResult<ResumeUploadReceipt>> {
  const parsed = ResumeUploadSchema.safeParse(upload);

  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? NOT_STARTED_MESSAGE);
  }

  return withSession((token) => resumeClient.requestUpload(token, parsed.data), NOT_STARTED_MESSAGE);
}

export async function completeResumeAction(id: string): Promise<ResumeActionResult<UploadedResume>> {
  return withSession((token) => resumeClient.complete(token, id), NOT_CONFIRMED_MESSAGE);
}

export async function readResumeAction(id: string, etag: string | undefined): Promise<ResumeActionResult<ResumeRead>> {
  return withSession((token) => resumeClient.read(token, id, etag), NOT_READ_MESSAGE);
}
