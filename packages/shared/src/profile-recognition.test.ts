import { describe, expect, it } from "vitest";

import { CurationActionErrorCodeSchema } from "./curation.js";
import { ModelChoiceErrorCodeSchema } from "./model-choice.js";
import { ProfileRecognitionErrorCodeSchema, ProfileRecognitionReceiptSchema } from "./profile-recognition.js";
import { ResumeUploadErrorCodeSchema } from "./resume-upload.js";

describe("ProfileRecognitionReceiptSchema", () => {
  it("accepts the id of the Uploaded Resume read again", () => {
    const receipt = { uploadedResumeId: "3f0f3c8e-5d0a-4a9b-9a53-2d4f5e6a7b8c" };

    expect(ProfileRecognitionReceiptSchema.parse(receipt)).toEqual(receipt);
  });

  it.each([
    ["an id that is not a UUID", { uploadedResumeId: "resume-1" }],
    ["no id", {}],
  ])("rejects %s", (_label, input) => {
    expect(ProfileRecognitionReceiptSchema.safeParse(input).success).toBe(false);
  });
});

describe("ProfileRecognitionErrorCodeSchema", () => {
  it("names every refusal of the route", () => {
    expect(ProfileRecognitionErrorCodeSchema.options).toEqual(["model_key_missing", "ingestion_active", "curation_active", "resume_text_missing"]);
  });

  it("shares the codes other routes answer for the same reason", () => {
    expect(ModelChoiceErrorCodeSchema.options).toContain("model_key_missing");
    expect(ResumeUploadErrorCodeSchema.options).toContain("ingestion_active");
    expect(CurationActionErrorCodeSchema.options).toContain("curation_active");
  });
});
