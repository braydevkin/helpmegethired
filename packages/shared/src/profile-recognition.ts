import { z } from "zod";

import { CurationActionErrorCodeSchema } from "./curation.js";
import { ModelChoiceErrorCodeSchema } from "./model-choice.js";
import { IdSchema } from "./primitives.js";
import { ResumeUploadErrorCodeSchema } from "./resume-upload.js";

// POST /profile/recognition: the Uploaded Resume whose stored text is read again, which
// GET /resumes/:id follows until its new Ingestion ends.
export const ProfileRecognitionReceiptSchema = z.object({
  uploadedResumeId: IdSchema,
});

export type ProfileRecognitionReceipt = z.infer<typeof ProfileRecognitionReceiptSchema>;

// The codes other routes already answer keep their meaning here, so each is taken from its own list.
export const ProfileRecognitionErrorCodeSchema = z.enum([
  ...ModelChoiceErrorCodeSchema.extract(["model_key_missing"]).options,
  ...ResumeUploadErrorCodeSchema.extract(["ingestion_active"]).options,
  ...CurationActionErrorCodeSchema.extract(["curation_active"]).options,
  "resume_text_missing",
]);

export type ProfileRecognitionErrorCode = z.infer<typeof ProfileRecognitionErrorCodeSchema>;
