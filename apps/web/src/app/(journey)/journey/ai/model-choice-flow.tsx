"use client";

import { ModelChoiceRequestSchema, type AccountModelChoice, type ModelCatalogueEntry } from "@helpmegethired/shared";
import { useCallback } from "react";

import { ModelChoiceSetup, type ModelChoiceResult } from "../../../../components/organisms/model-choice-setup/model-choice-setup";
import { keyShapeMessageOf, saveFailureMessageOf } from "../../../../lib/model-choice-messages";
import { sendModelKey } from "../../../../lib/model-key-sender";
import { PROVIDER_LINKS } from "../../../../lib/provider-links";
import { ANALYSIS_PATH } from "../../../paths";
import { requestModelKeyTicketAction, revokeModelKeyAction } from "./actions";

export interface ModelChoiceFlowProps {
  entry: ModelCatalogueEntry;
  initialChoice: AccountModelChoice | null;
  apiPublicUrl: string;
}

export function ModelChoiceFlow({ entry, initialChoice, apiPublicUrl }: ModelChoiceFlowProps) {
  // Every submit asks for its own ticket, because the API spends one even on a key the Provider refuses.
  const save = useCallback(
    async (key: string): Promise<ModelChoiceResult> => {
      const request = ModelChoiceRequestSchema.safeParse({ provider: entry.provider, modelId: entry.modelId, key });

      if (!request.success) {
        return { ok: false, message: keyShapeMessageOf(entry.providerName) };
      }

      const ticket = await requestModelKeyTicketAction();

      if (!ticket.ok) {
        return ticket;
      }

      try {
        return { ok: true, choice: await sendModelKey(apiPublicUrl, ticket.value.ticket, request.data) };
      } catch (error) {
        return { ok: false, message: saveFailureMessageOf(error, entry.providerName) };
      }
    },
    [apiPublicUrl, entry],
  );

  return (
    <ModelChoiceSetup
      entry={entry}
      initialChoice={initialChoice}
      links={PROVIDER_LINKS[entry.provider]}
      analysisHref={ANALYSIS_PATH}
      save={save}
      revoke={revokeModelKeyAction}
    />
  );
}
