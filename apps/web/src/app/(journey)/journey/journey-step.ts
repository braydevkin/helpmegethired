import type { Profile } from "@helpmegethired/shared";

export type JourneyStep = "resume" | "profile" | "analysis";

// The journey opens on the step the Candidate is on: the résumé until an Ingestion has built a
// Profile, its review until the Candidate confirms it, then the analysis.
export function journeyStepOf({ source, confirmedAt }: Pick<Profile, "source" | "confirmedAt">): JourneyStep {
  if (source === null) {
    return "resume";
  }

  return confirmedAt === null ? "profile" : "analysis";
}
