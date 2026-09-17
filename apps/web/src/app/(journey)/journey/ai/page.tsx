import { MODEL_CATALOGUE, type AccountModelChoice, type ModelCatalogueEntry } from "@helpmegethired/shared";
import type { Metadata } from "next";

import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import { apiPublicUrl } from "../../../../config/api-url";
import { modelChoiceClient } from "../../../../lib/model-choice-client";
import { profileClient } from "../../../../lib/profile-client";
import { requireCandidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { ModelChoiceFlow } from "./model-choice-flow";
import { nextStepActionOf } from "./next-step-action";

export const metadata: Metadata = { title: "Choose your AI | Help Me Get Hired" };

function catalogueEntryFor(choice: AccountModelChoice | null): ModelCatalogueEntry {
  const [recommended] = MODEL_CATALOGUE;
  const entry = MODEL_CATALOGUE.find(({ provider, modelId }) => provider === choice?.provider && modelId === choice.modelId) ?? recommended;

  if (!entry) {
    throw new Error("The model catalogue has no entry to offer");
  }

  return entry;
}

export default async function ModelChoicePage() {
  const candidate = await requireCandidate();
  const [{ choice }, profile] = await Promise.all([modelChoiceClient.read(candidate.token), profileClient.get(candidate.token)]);

  return (
    <JourneyFrame
      candidate={candidate}
      stepLabel="Step 1 · Choose your AI"
      heading={
        <ScreenHeading
          eyebrow="Before we read your résumé"
          title="Which AI should read your profile?"
          lead="This choice applies to your whole account — reading your résumé, the analysis of your profile, and every job you match afterwards. You can change it later, but changing it means running the analysis again."
        />
      }
    >
      <ModelChoiceFlow entry={catalogueEntryFor(choice)} initialChoice={choice} next={nextStepActionOf(profile)} apiPublicUrl={apiPublicUrl} />
    </JourneyFrame>
  );
}
