"use client";

import type { AccountModelChoice, ModelCatalogueEntry } from "@helpmegethired/shared";
import { useId, useState, type ComponentProps } from "react";

import { ChoiceCard } from "../../molecules/choice-card/choice-card";
import { SetupSummary } from "../../molecules/setup-summary/setup-summary";
import { ApiKeySection } from "./api-key-section";
import styles from "./model-choice-setup.module.css";

export type ModelChoiceResult = { ok: true; choice: AccountModelChoice } | { ok: false; message: string };

export interface ModelChoiceSetupProps {
  entry: ModelCatalogueEntry;
  initialChoice: AccountModelChoice | null;
  links: { keyConsole: string; terms: string };
  analysisHref: string;
  save: (key: string) => Promise<ModelChoiceResult>;
  revoke: () => Promise<ModelChoiceResult>;
}

const summaryRowsOf = (entry: ModelCatalogueEntry, keyStored: boolean): ComponentProps<typeof SetupSummary>["rows"] => [
  { label: "Provider", value: entry.providerName },
  { label: "Model", value: `${entry.modelId} · pinned` },
  { label: "API key", value: keyStored ? `Stored · billed by ${entry.providerName}` : "Not added yet", pending: !keyStored },
  { label: "Applies to", value: "Your whole account" },
];

export function ModelChoiceSetup({ entry, initialChoice, links, analysisHref, save, revoke }: ModelChoiceSetupProps) {
  const [keyStored, setKeyStored] = useState(initialChoice?.keyStored ?? false);
  const id = useId();
  const provider = entry.providerName;

  return (
    <div className={styles.layout}>
      <div className={styles.sections}>
        <section aria-labelledby={`${id}-provider`} className={styles.card}>
          <h2 id={`${id}-provider`} className={styles.title}>
            Provider
          </h2>
          <p className={styles.lead}>Where your profile text is sent for analysis.</p>
          <ChoiceCard mark={provider.charAt(0)} name={provider} detail="The only provider available for now." badge="Selected" />
        </section>

        <section aria-labelledby={`${id}-model`} className={styles.card}>
          <h2 id={`${id}-model`} className={styles.title}>
            Model
          </h2>
          <p className={styles.lead}>We pin the exact version, so your results stay reproducible and a newer version never arrives unannounced.</p>
          <ChoiceCard name={entry.modelId} detail={entry.description} badge="Pinned" />
        </section>

        <ApiKeySection provider={provider} links={links} keyStored={keyStored} onKeyStoredChange={setKeyStored} save={save} revoke={revoke} />
      </div>

      <SetupSummary
        rows={summaryRowsOf(entry, keyStored)}
        action={{ href: analysisHref, label: "Continue to the analysis" }}
        ready={keyStored}
        reason="Add your API key to continue."
        hint="The analysis runs on its own, so you can close the tab once it starts."
      />
    </div>
  );
}
