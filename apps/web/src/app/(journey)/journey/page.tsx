import type { Metadata } from "next";

import { ResumeStep } from "./resume/resume-step";

export const metadata: Metadata = { title: "Your journey | Help Me Get Hired" };

// The journey opens on its current step; until a Profile page exists, that is the résumé.
export default function JourneyPage() {
  return <ResumeStep />;
}
