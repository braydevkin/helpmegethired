"use client";

import type { BasicProfile } from "@helpmegethired/shared";
import { useActionState, useState } from "react";

import type { CorrectionAction, CorrectionResult } from "../../../lib/profile/correction-form";
import { Button } from "../../atoms/button/button";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import { TextArea } from "../../atoms/text-area/text-area";
import { TextInput } from "../../atoms/text-input/text-input";
import { Field } from "../../molecules/field/field";
import { ProfileSection } from "../../molecules/profile-section/profile-section";
import styles from "./basic-profile-card.module.css";

export interface BasicProfileCardProps {
  basicProfile: BasicProfile;
  corrected: boolean;
  editable: boolean;
  save: CorrectionAction;
}

const NOT_GIVEN = "Not found in your résumé";

const CORRECTED_LABEL = "Corrected by you";

// What the résumé said about the Candidate as a whole, and their answer to it. The name,
// e-mail, phone and address are Account Information and are not corrected here.
export function BasicProfileCard({ basicProfile, corrected, editable, save }: BasicProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const [result, submit, saving] = useActionState(async (previous: CorrectionResult | null, form: FormData) => {
    const outcome = await save(previous, form);

    setEditing(!outcome.ok);

    return outcome;
  }, null);

  const issues = result?.ok === false ? (result.issues ?? {}) : {};

  if (!editing) {
    return (
      <ProfileSection title="About you" meta={corrected ? CORRECTED_LABEL : undefined}>
        <dl className={styles.read}>
          <Read label="Headline" value={basicProfile.headline} />
          <Read label="Summary" value={basicProfile.summary} />
          <Read label="LinkedIn" value={basicProfile.linkedinUrl} />
          <Read label="GitHub" value={basicProfile.githubUrl} />
        </dl>
        {editable && (
          <Button variant="secondary" type="button" className={styles.action} onClick={() => setEditing(true)}>
            Correct this
          </Button>
        )}
      </ProfileSection>
    );
  }

  return (
    <ProfileSection title="About you">
      <form action={submit} className={styles.form}>
        <Field id="headline" label="Headline" error={issues.headline}>
          {(control) => <TextInput {...control} name="headline" defaultValue={basicProfile.headline ?? ""} />}
        </Field>
        <Field id="summary" label="Summary" optional error={issues.summary}>
          {(control) => <TextArea {...control} name="summary" rows={4} defaultValue={basicProfile.summary ?? ""} />}
        </Field>
        <Field id="linkedinUrl" label="LinkedIn" optional error={issues.linkedinUrl}>
          {(control) => <TextInput {...control} name="linkedinUrl" inputMode="url" defaultValue={basicProfile.linkedinUrl ?? ""} />}
        </Field>
        <Field id="githubUrl" label="GitHub" optional error={issues.githubUrl}>
          {(control) => <TextInput {...control} name="githubUrl" inputMode="url" defaultValue={basicProfile.githubUrl ?? ""} />}
        </Field>
        <div className={styles.actions}>
          <Button type="submit" className={styles.action} disabled={saving}>
            Save
          </Button>
          <Button variant="secondary" type="button" className={styles.action} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {result?.ok === false && <ErrorMessage>{result.message}</ErrorMessage>}
      </form>
    </ProfileSection>
  );
}

function Read({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={value === null ? styles.missing : styles.value}>{value ?? NOT_GIVEN}</dd>
    </div>
  );
}
