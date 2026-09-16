import { describe, expect, it } from "vitest";

import { ProfileRecognitionRefusedError } from "../profile-recognition-client";
import { RECOGNITION_NOT_STARTED_MESSAGE, recognitionRefusalMessageOf } from "./recognition-refusal";

describe("recognitionRefusalMessageOf", () => {
  it.each([
    ["model_key_missing", "Your API key isn't stored anymore. Add it again on Choose your AI, then try again."],
    ["ingestion_active", "Your résumé is already being read. Wait for it to finish, then try again."],
    ["curation_active", "Your profile analysis is still running. Let it finish or stop it, then try again."],
    ["resume_text_missing", "We no longer have the text of your résumé. Upload the PDF again instead."],
  ] as const)("puts %s in words", (code, message) => {
    expect(recognitionRefusalMessageOf(new ProfileRecognitionRefusedError(code, code === "resume_text_missing" ? 404 : 409))).toBe(message);
  });

  it("falls back to the step's own message for a refusal without a code and for any other failure", () => {
    expect(recognitionRefusalMessageOf(new ProfileRecognitionRefusedError(undefined, 502))).toBe(RECOGNITION_NOT_STARTED_MESSAGE);
    expect(recognitionRefusalMessageOf(new TypeError("fetch failed"))).toBe(RECOGNITION_NOT_STARTED_MESSAGE);
  });
});
