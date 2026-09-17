import type { Metadata } from "next";

import { modelChoiceClient } from "../../../../lib/model-choice-client";
import { requireCandidate } from "../candidate";
import { modelKeyStoredOf } from "../journey-step";
import { ResumeStep } from "./resume-step";

export const metadata: Metadata = { title: "Upload your résumé | Help Me Get Hired" };

export default async function ResumeStepPage() {
  const candidate = await requireCandidate();
  const modelChoice = await modelChoiceClient.read(candidate.token);

  return <ResumeStep candidate={candidate} modelKeyStored={modelKeyStoredOf(modelChoice)} />;
}
