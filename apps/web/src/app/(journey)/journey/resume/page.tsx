import type { Metadata } from "next";

import { requireCandidate } from "../candidate";
import { ResumeStep } from "./resume-step";

export const metadata: Metadata = { title: "Upload your résumé | Help Me Get Hired" };

export default async function ResumeStepPage() {
  return <ResumeStep candidate={await requireCandidate()} />;
}
