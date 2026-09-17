import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { modelChoiceClient } from "../../../lib/model-choice-client";
import { profileClient } from "../../../lib/profile-client";
import { ANALYSIS_PATH, MODEL_CHOICE_PATH } from "../../paths";
import { requireCandidate } from "./candidate";
import { journeyStepOf, modelKeyStoredOf } from "./journey-step";
import { ProfileStep } from "./profile/profile-step";
import { ResumeStep } from "./resume/resume-step";

export const metadata: Metadata = { title: "Your journey | Help Me Get Hired" };

export default async function JourneyPage() {
  const candidate = await requireCandidate();
  const [profile, modelChoice] = await Promise.all([profileClient.get(candidate.token), modelChoiceClient.read(candidate.token)]);
  const step = journeyStepOf({ modelKeyStored: modelKeyStoredOf(modelChoice), profile });

  if (step === "ai") {
    redirect(MODEL_CHOICE_PATH);
  }

  if (step === "analysis") {
    redirect(ANALYSIS_PATH);
  }

  return step === "resume" ? <ResumeStep candidate={candidate} modelKeyStored /> : <ProfileStep candidate={candidate} profile={profile} />;
}
