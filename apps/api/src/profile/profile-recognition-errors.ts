import type { ProfileRecognitionErrorCode } from "@helpmegethired/shared";

const REFUSAL_MESSAGES: Record<ProfileRecognitionErrorCode, string> = {
  model_key_missing: "The Account has no Model Key; store one to have the résumé read with the Candidate's Model",
  ingestion_active: "An upload or an Ingestion of the Account is already in flight",
  curation_active: "A Curation is queued or running; it has to end before the Profile is rebuilt",
  resume_text_missing: "The Profile has no Uploaded Resume with stored text to read again",
};

export class ProfileRecognitionRefusedError extends Error {
  constructor(readonly code: ProfileRecognitionErrorCode) {
    super(REFUSAL_MESSAGES[code]);
    this.name = "ProfileRecognitionRefusedError";
  }
}
