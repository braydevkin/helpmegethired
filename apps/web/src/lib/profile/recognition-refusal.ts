import type { ProfileRecognitionErrorCode } from "@helpmegethired/shared";

import { ProfileRecognitionRefusedError } from "../profile-recognition-client";

export const RECOGNITION_NOT_STARTED_MESSAGE = "We couldn't start reading your résumé again. Try again in a moment.";

const REFUSAL_MESSAGES: Record<ProfileRecognitionErrorCode, string> = {
  model_key_missing: "Your API key isn't stored anymore. Add it again on Choose your AI, then try again.",
  ingestion_active: "Your résumé is already being read. Wait for it to finish, then try again.",
  curation_active: "Your profile analysis is still running. Let it finish or stop it, then try again.",
  resume_text_missing: "We no longer have the text of your résumé. Upload the PDF again instead.",
};

// The page's own words for each code, so nothing the API or a proxy wrote reaches the Candidate.
export function recognitionRefusalMessageOf(error: unknown): string {
  return error instanceof ProfileRecognitionRefusedError && error.code ? REFUSAL_MESSAGES[error.code] : RECOGNITION_NOT_STARTED_MESSAGE;
}
