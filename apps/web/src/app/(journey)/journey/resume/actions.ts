"use server";

import { ResumeUploadSchema, type ResumeRefusalCode, type ResumeUpload, type ResumeUploadReceipt, type UploadedResume } from "@helpmegethired/shared";

import { refusalMessageOf } from "../../../../lib/resume-upload/progress";
import { ResumeRefusedError, resumeClient, type ResumeRead } from "../../../../lib/resume-client";
import { withSession, type ActionFailure, type ActionResult } from "../../../../lib/with-session";

// The refusal's code travels with its copy, so the page can switch to the step the code leads to.
export interface ResumeActionFailure extends ActionFailure {
  code?: ResumeRefusalCode;
}

export type ResumeActionResult<Value> = ActionResult<Value, ResumeActionFailure>;

const NOT_STARTED_MESSAGE = "We couldn't start the upload. Try again in a moment.";
const NOT_CONFIRMED_MESSAGE = "We couldn't confirm the upload. Try again in a moment.";
const NOT_READ_MESSAGE = "We lost track of the upload. Reload the page to see where it is.";

const failure = (message: string): ActionFailure => ({ ok: false, message });

// A refusal with a code has designed copy; anything else gets the step's own message.
const refusedWith =
  (fallback: string) =>
  (error: unknown): ResumeActionFailure =>
    error instanceof ResumeRefusedError && error.code ? { ok: false, message: refusalMessageOf(error.code), code: error.code } : failure(fallback);

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
