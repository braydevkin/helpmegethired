import type { UploadedResume } from "@helpmegethired/shared";

import { resumeClient } from "../../../../lib/resume-client";
import { PROFILE_PATH } from "../../../paths";
import { requireCandidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { ResumeUploadFlow } from "./resume-upload-flow";

const SHOWN_ON_LOAD = new Set<UploadedResume["status"]>(["uploaded", "processing", "done", "failed"]);

// The newest record decides what the page shows after a reload or on another device; a
// pending one never got its bytes, so the page starts over.
async function newestShownResume(token: string): Promise<UploadedResume | null> {
  const [newest] = await resumeClient.list(token);

  return newest && SHOWN_ON_LOAD.has(newest.status) ? newest : null;
}

export async function ResumeStep() {
  const candidate = await requireCandidate();
  const initialResume = await newestShownResume(candidate.token);

  return (
    <JourneyFrame candidate={candidate} stepLabel="Step 1 · Your résumé">
      <ResumeUploadFlow initialResume={initialResume} profileHref={PROFILE_PATH} />
    </JourneyFrame>
  );
}
