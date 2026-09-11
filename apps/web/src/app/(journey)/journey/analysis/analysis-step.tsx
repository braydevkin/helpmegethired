import type { CurationProgressState, Profile } from "@helpmegethired/shared";

import { gateNoticeOf } from "../../../../lib/curation-analysis/view";
import { curationClient } from "../../../../lib/curation-client";
import { statementClient } from "../../../../lib/statement-client";
import { JOURNEY_PATH, MODEL_CHOICE_PATH, PROFILE_PATH } from "../../../paths";
import type { Candidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { AnalysisFlow } from "./analysis-flow";
import { AnalysisGate } from "./analysis-gate";
import { ModelChoiceFirst } from "./model-choice-first";

export interface AnalysisStepProps {
  candidate: Candidate;
  profile: Profile;
}

const STEP_LABEL = "Step 2 · Profile analysis";
const NO_CURATION: CurationProgressState = { progress: null };

// Confirming the Profile and storing a Model Key are the two things that create a Curation, so
// a confirmed Profile with none is waiting on the key.
export async function AnalysisStep({ candidate, profile }: AnalysisStepProps) {
  if (profile.confirmedAt === null) {
    return (
      <JourneyFrame candidate={candidate} stepLabel={STEP_LABEL}>
        <AnalysisGate notice={gateNoticeOf(profile.reviewFlags)} reviewHref={PROFILE_PATH} laterHref={JOURNEY_PATH} />
      </JourneyFrame>
    );
  }

  const [read, statements] = await Promise.all([curationClient.read(candidate.token, undefined), statementClient.list(candidate.token)]);
  const initial = read.changed ? read.state : NO_CURATION;

  if (initial.progress === null) {
    return (
      <JourneyFrame candidate={candidate} stepLabel={STEP_LABEL}>
        <ModelChoiceFirst modelChoiceHref={MODEL_CHOICE_PATH} />
      </JourneyFrame>
    );
  }

  return (
    <JourneyFrame candidate={candidate} stepLabel={STEP_LABEL} wide>
      <AnalysisFlow
        initial={initial}
        initialStatements={statements}
        run={{ basedOn: profile.source?.fileName ?? null, confirmedAt: profile.confirmedAt }}
        links={{ journey: JOURNEY_PATH, modelChoice: MODEL_CHOICE_PATH }}
      />
    </JourneyFrame>
  );
}
