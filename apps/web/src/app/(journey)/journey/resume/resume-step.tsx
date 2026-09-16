import type { UploadedResume } from "@helpmegethired/shared";

import { resumeClient } from "../../../../lib/resume-client";
import { PROFILE_PATH } from "../../../paths";
import type { Candidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { ResumeUploadFlow } from "./resume-upload-flow";

export interface ResumeStepProps {
  candidate: Candidate;
}

const SHOWN_ON_LOAD = new Set<UploadedResume["status"]>(["uploaded", "processing", "done", "failed"]);
const IN_FLIGHT = new Set<UploadedResume["status"]>(["uploaded", "processing"]);

// The record in flight, when there is one, is what the page follows: reading an earlier résumé's
// text again puts that older record back in processing. Otherwise the newest record decides what
// the page shows after a reload or on another device; a pending one never got its bytes, so the
// page starts over.
async function shownResume(token: string): Promise<UploadedResume | null> {
  const resumes = await resumeClient.list(token);
  const shown = resumes.find((resume) => IN_FLIGHT.has(resume.status)) ?? resumes[0];

  return shown && SHOWN_ON_LOAD.has(shown.status) ? shown : null;
}

export async function ResumeStep({ candidate }: ResumeStepProps) {
  const initialResume = await shownResume(candidate.token);

  return (
    <JourneyFrame candidate={candidate} stepLabel="Step 1 · Your résumé">
      <ResumeUploadFlow initialResume={initialResume} profileHref={PROFILE_PATH} />
    </JourneyFrame>
  );
}
