"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "../../atoms/button/button";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import { TextInput } from "../../atoms/text-input/text-input";
import { Field } from "../../molecules/field/field";
import type { ModelChoiceResult } from "./model-choice-setup";
import styles from "./model-choice-setup.module.css";

export interface ApiKeySectionProps {
  provider: string;
  links: { keyConsole: string; terms: string };
  keyStored: boolean;
  onKeyStoredChange: (keyStored: boolean) => void;
  save: (key: string) => Promise<ModelChoiceResult>;
  revoke: () => Promise<ModelChoiceResult>;
}

interface StoredKeyProps {
  provider: string;
  replacing: boolean;
  onReplaceToggle: () => void;
  revoke: () => Promise<ModelChoiceResult>;
  onRevoked: (keyStored: boolean) => void;
}

interface KeyFormProps {
  provider: string;
  save: (key: string) => Promise<ModelChoiceResult>;
  onSaved: (keyStored: boolean) => void;
}

const keyOf = (formData: FormData): string => {
  const key = formData.get("key");

  return typeof key === "string" ? key : "";
};

export function ApiKeySection({ provider, links, keyStored, onKeyStoredChange, save, revoke }: ApiKeySectionProps) {
  const [replacing, setReplacing] = useState(false);
  const titleId = useId();

  const keySaved = (stored: boolean) => {
    onKeyStoredChange(stored);
    setReplacing(false);
  };

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.title}>
        Your API key
      </h2>
      <p className={styles.lead}>{`You use your own key and pay ${provider} directly. We never resell tokens or hold a balance for you.`}</p>

      {keyStored && (
        <StoredKey provider={provider} replacing={replacing} onReplaceToggle={() => setReplacing((current) => !current)} revoke={revoke} onRevoked={onKeyStoredChange} />
      )}
      {(!keyStored || replacing) && <KeyForm provider={provider} save={save} onSaved={keySaved} />}

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
  );
}

function StoredKey({ provider, replacing, onReplaceToggle, revoke, onRevoked }: StoredKeyProps) {
  const explanationId = useId();

  const [revokeFailure, revokeKey, revoking] = useActionState(async (): Promise<string | null> => {
    const result = await revoke();

    if (!result.ok) {
      return result.message;
    }

    onRevoked(result.choice.keyStored);

    return null;
  }, null);

  return (
    <>
      <div role="status" className={styles.stored}>
        <p className={styles.storedTitle}>{`Your ${provider} key is stored`}</p>
        <p>Encrypted, used only for your account, and never shown again.</p>
      </div>
      <div className={styles.keyActions}>
        <Button variant="secondary" type="button" onClick={onReplaceToggle}>
          {replacing ? "Keep the stored key" : "Replace key"}
        </Button>
        <form action={revokeKey}>
          <Button variant="secondary" type="submit" disabled={revoking} aria-describedby={explanationId}>
            Revoke key
          </Button>
        </form>
      </div>
      <p id={explanationId} className={styles.explanation}>
        {`Revoking deletes the key we store. No analysis can run until you add a key again. To stop the key everywhere, revoke it in your ${provider} console too.`}
      </p>
      {revokeFailure && <ErrorMessage>{revokeFailure}</ErrorMessage>}
    </>
  );
}

// The key is read from the submitted form and handed on, never kept in state; React empties the
// uncontrolled field once the submit settles, whether the key was saved or refused.
function KeyForm({ provider, save, onSaved }: KeyFormProps) {
  const fieldId = useId();

  const [saveFailure, saveKey, saving] = useActionState(async (_previous: string | null, formData: FormData): Promise<string | null> => {
    const result = await save(keyOf(formData));

    if (!result.ok) {
      return result.message;
    }

    onSaved(result.choice.keyStored);

    return null;
  }, null);

  return (
    <form action={saveKey} className={styles.form}>
      <Field
        id={fieldId}
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
  );
}
