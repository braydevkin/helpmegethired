import type { ModelChoiceState, Profile } from "@helpmegethired/shared";

export type JourneyStep = "ai" | "resume" | "profile" | "analysis";

export type StepAfterModelChoice = Exclude<JourneyStep, "ai">;

export interface JourneyState {
  modelKeyStored: boolean;
  profile: Pick<Profile, "source" | "confirmedAt">;
}

export const modelKeyStoredOf = ({ choice }: ModelChoiceState): boolean => choice?.keyStored === true;

// With a key stored: the résumé until an Ingestion has built a Profile, its review until the
// Candidate confirms it, then the analysis.
export function stepAfterModelChoiceOf({ source, confirmedAt }: JourneyState["profile"]): StepAfterModelChoice {
  if (source === null) {
    return "resume";
  }

  return confirmedAt === null ? "profile" : "analysis";
}

// The Candidate's own Model reads the résumé at the upload, so the journey opens on choosing it
// until a key is stored, even for an Account whose Profile was built before that order.
export function journeyStepOf({ modelKeyStored, profile }: JourneyState): JourneyStep {
  return modelKeyStored ? stepAfterModelChoiceOf(profile) : "ai";
}
