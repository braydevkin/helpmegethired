import type { Metadata } from "next";

import { profileClient } from "../../../lib/profile-client";
import { requireCandidate } from "./candidate";
import { ProfileStep } from "./profile/profile-step";
import { ResumeStep } from "./resume/resume-step";

export const metadata: Metadata = { title: "Your journey | Help Me Get Hired" };

// The journey opens on the step the Candidate is on: the résumé until an Ingestion has
// built a Profile, then its review. The LinkedIn step (FR-03) arrives with its own task.
export default async function JourneyPage() {
  const candidate = await requireCandidate();
  const profile = await profileClient.get(candidate.token);

  return profile.source ? <ProfileStep candidate={candidate} profile={profile} /> : <ResumeStep candidate={candidate} />;
}
