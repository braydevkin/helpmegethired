import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { profileClient } from "../../../lib/profile-client";
import { ANALYSIS_PATH } from "../../paths";
import { requireCandidate } from "./candidate";
import { journeyStepOf } from "./journey-step";
import { ProfileStep } from "./profile/profile-step";
import { ResumeStep } from "./resume/resume-step";

export const metadata: Metadata = { title: "Your journey | Help Me Get Hired" };

export default async function JourneyPage() {
  const candidate = await requireCandidate();
  const profile = await profileClient.get(candidate.token);
  const step = journeyStepOf(profile);

  if (step === "analysis") {
    redirect(ANALYSIS_PATH);
  }

  return step === "resume" ? <ResumeStep candidate={candidate} /> : <ProfileStep candidate={candidate} profile={profile} />;
}
