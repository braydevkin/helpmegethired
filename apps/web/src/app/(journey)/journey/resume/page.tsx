import type { Metadata } from "next";

import { ResumeStep } from "./resume-step";

export const metadata: Metadata = { title: "Upload your résumé | Help Me Get Hired" };

export default function ResumeStepPage() {
  return <ResumeStep />;
}
