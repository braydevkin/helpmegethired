"use client";

import type { AccountModelChoice, ModelCatalogueEntry } from "@helpmegethired/shared";
import { useActionState, useId, useState } from "react";

import { Button } from "../../atoms/button/button";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import { TextInput } from "../../atoms/text-input/text-input";
import { ChoiceCard } from "../../molecules/choice-card/choice-card";
import { Field } from "../../molecules/field/field";
import { SetupSummary } from "../../molecules/setup-summary/setup-summary";
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

const keyOf = (formData: FormData): string => {
  const key = formData.get("key");

  return typeof key === "string" ? key : "";
};

// The key is read from the submitted form and handed on, never kept in state; React empties the
// uncontrolled field once the submit settles, whether the key was saved or refused.
export function ModelChoiceSetup({ entry, initialChoice, links, analysisHref, save, revoke }: ModelChoiceSetupProps) {
  const [keyStored, setKeyStored] = useState(initialChoice?.keyStored ?? false);
  const [replacing, setReplacing] = useState(false);
  const id = useId();
  const provider = entry.providerName;

  const [saveFailure, saveKey, saving] = useActionState(async (_previous: string | null, formData: FormData): Promise<string | null> => {
    const result = await save(keyOf(formData));

    if (!result.ok) {
      return result.message;
    }

    setKeyStored(result.choice.keyStored);
    setReplacing(false);

    return null;
  }, null);

  const [revokeFailure, revokeKey, revoking] = useActionState(async (): Promise<string | null> => {
    const result = await revoke();

    if (!result.ok) {
      return result.message;
    }

    setKeyStored(result.choice.keyStored);

    return null;
  }, null);

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

        <section aria-labelledby={`${id}-key`} className={styles.card}>
          <h2 id={`${id}-key`} className={styles.title}>
            Your API key
          </h2>
          <p className={styles.lead}>{`You use your own key and pay ${provider} directly. We never resell tokens or hold a balance for you.`}</p>

          {keyStored && (
            <>
              <div role="status" className={styles.stored}>
                <p className={styles.storedTitle}>{`Your ${provider} key is stored`}</p>
                <p>Encrypted, used only for your account, and never shown again.</p>
              </div>
              <div className={styles.keyActions}>
                <Button variant="secondary" type="button" onClick={() => setReplacing((current) => !current)}>
                  {replacing ? "Keep the stored key" : "Replace key"}
                </Button>
                <form action={revokeKey}>
                  <Button variant="secondary" type="submit" disabled={revoking} aria-describedby={`${id}-revoke`}>
                    Revoke key
                  </Button>
                </form>
              </div>
              <p id={`${id}-revoke`} className={styles.explanation}>
                {`Revoking deletes the key we store. No analysis can run until you add a key again. To stop the key everywhere, revoke it in your ${provider} console too.`}
              </p>
              {revokeFailure && <ErrorMessage>{revokeFailure}</ErrorMessage>}
            </>
          )}

          {(!keyStored || replacing) && (
            <form action={saveKey} className={styles.form}>
              <Field
                id={`${id}-key-field`}
                label={`${provider} API key`}
                hint={`Create a key in your ${provider} console. ${provider} bills your card for it, not us.`}
                error={saveFailure ?? undefined}
              >
                {(control) => <TextInput {...control} name="key" type="password" autoComplete="off" spellCheck={false} required />}
              </Field>
              <Button type="submit" disabled={saving}>
                {saving ? "Checking the key…" : "Save key"}
              </Button>
            </form>
          )}

          <p className={styles.note}>
            <span>Stored encrypted, used only for your account, and never shown again after saving.</span>
            <a className={styles.link} href={links.keyConsole} target="_blank" rel="noreferrer">
              Where do I find this?
            </a>
          </p>
          <p className={styles.retention}>
            {`We send your profile text only to ${provider}, using your key. What ${provider} does with it is governed by your own agreement with them: `}
            <a className={styles.link} href={links.terms} target="_blank" rel="noreferrer">
              {`${provider}'s terms`}
            </a>
            .
          </p>
        </section>
      </div>

      <SetupSummary
        rows={[
          { label: "Provider", value: provider },
          { label: "Model", value: `${entry.modelId} · pinned` },
          { label: "API key", value: keyStored ? `Stored · billed by ${provider}` : "Not added yet", pending: !keyStored },
          { label: "Applies to", value: "Your whole account" },
        ]}
        action={{ href: analysisHref, label: "Continue to the analysis" }}
        ready={keyStored}
        reason="Add your API key to continue."
        hint="The analysis runs on its own, so you can close the tab once it starts."
      />
    </div>
  );
}
