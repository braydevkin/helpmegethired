import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { profileClient } from "../../../../lib/profile-client";
import { RESUME_STEP_PATH } from "../../../paths";
import { requireCandidate } from "../candidate";
import { ProfileStep } from "./profile-step";

export const metadata: Metadata = { title: "Your profile | Help Me Get Hired" };

// Without a completed Ingestion there is no Profile to review, so the journey sends the
// Candidate back to the upload step.
export default async function ProfilePage() {
  const candidate = await requireCandidate();
  const profile = await profileClient.get(candidate.token);

  if (!profile.source) {
    redirect(RESUME_STEP_PATH);
  }

  return <ProfileStep candidate={candidate} profile={profile} />;
}
