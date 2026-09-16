import type { NextStepAction } from "../../../../components/organisms/model-choice-setup/model-choice-setup";
import { ANALYSIS_PATH, PROFILE_PATH, RESUME_STEP_PATH } from "../../../paths";
import { stepAfterModelChoiceOf, type JourneyState, type StepAfterModelChoice } from "../journey-step";

const NEXT_STEP_ACTIONS: Record<StepAfterModelChoice, NextStepAction> = {
  resume: {
    href: RESUME_STEP_PATH,
    label: "Continue to your résumé",
    hint: "Upload your résumé next: the model you chose reads it to build your profile.",
  },
  profile: {
    href: PROFILE_PATH,
    label: "Continue to your profile",
    hint: "Review and confirm your profile next, and the analysis starts on its own.",
  },
  analysis: {
    href: ANALYSIS_PATH,
    label: "Continue to the analysis",
    hint: "The analysis runs on its own, so you can close the tab once it starts.",
  },
};

// The action is only enabled once a key is stored, so it leads where the journey opens with one.
export const nextStepActionOf = (profile: JourneyState["profile"]): NextStepAction => NEXT_STEP_ACTIONS[stepAfterModelChoiceOf(profile)];
