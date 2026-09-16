import type { UploadedResume } from "@helpmegethired/shared";

import { resumeClient } from "../../../../lib/resume-client";
import { MODEL_CHOICE_PATH, PROFILE_PATH } from "../../../paths";
import type { Candidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { ResumeUploadFlow } from "./resume-upload-flow";

export interface ResumeStepProps {
  candidate: Candidate;
  modelKeyStored: boolean;
}

const SHOWN_ON_LOAD = new Set<UploadedResume["status"]>(["uploaded", "processing", "done", "failed"]);

// The newest record decides what the page shows after a reload or on another device; a
// pending one never got its bytes, so the page starts over.
async function newestShownResume(token: string): Promise<UploadedResume | null> {
  const [newest] = await resumeClient.list(token);

  return newest && SHOWN_ON_LOAD.has(newest.status) ? newest : null;
}

export async function ResumeStep({ candidate, modelKeyStored }: ResumeStepProps) {
  const initialResume = await newestShownResume(candidate.token);

  return (
    <JourneyFrame candidate={candidate} stepLabel="Step 2 · Your résumé">
      <ResumeUploadFlow initialResume={initialResume} modelKeyStored={modelKeyStored} profileHref={PROFILE_PATH} modelChoiceHref={MODEL_CHOICE_PATH} />
    </JourneyFrame>
  );
}
