"use client";

import type { BasicProfile } from "@helpmegethired/shared";
import type { Ref } from "react";

import { CORRECTED_LABEL } from "../../../lib/profile/corrected-label";
import type { CorrectionAction } from "../../../lib/profile/correction-form";
import { useCorrectionForm } from "../../../lib/profile/use-correction-form";
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
  editing: boolean;
  save: CorrectionAction;
  onClose: () => void;
  onEdit?: () => void;
  editRef?: Ref<HTMLButtonElement>;
}

const NOT_GIVEN = "Not found in your PDF";

// What the résumé said about the Candidate as a whole, and their answer to it. The headline
// and the two addresses are read in the header and the sidebar, so the card shows only the
// summary until it is corrected. The name, e-mail, phone and address are Account Information.
export function BasicProfileCard({ basicProfile, corrected, editing, save, onClose, onEdit, editRef }: BasicProfileCardProps) {
  return (
    <ProfileSection title="About you" meta={corrected ? CORRECTED_LABEL : undefined}>
      {editing ? (
        <BasicProfileForm basicProfile={basicProfile} save={save} onClose={onClose} />
      ) : (
        <>
          <dl className={styles.read}>
            <div className={styles.row}>
              <dt className={styles.label}>Summary</dt>
              <dd className={basicProfile.summary === null ? styles.missing : styles.value}>{basicProfile.summary ?? NOT_GIVEN}</dd>
            </div>
          </dl>
          {onEdit && (
            <Button ref={editRef} variant="secondary" type="button" className={styles.action} onClick={onEdit}>
              Correct this
            </Button>
          )}
        </>
      )}
    </ProfileSection>
  );
}

interface BasicProfileFormProps {
  basicProfile: BasicProfile;
  save: CorrectionAction;
  onClose: () => void;
}

// Mounted only while the card is being corrected, so a refusal from one attempt is gone the
// next time the Candidate opens it.
function BasicProfileForm({ basicProfile, save, onClose }: BasicProfileFormProps) {
  const { formRef, onSubmit, saving, failure, issues } = useCorrectionForm(save, onClose);

  return (
    <form ref={formRef} onSubmit={onSubmit} className={styles.form}>
      <Field id="headline" label="Headline" optional error={issues.headline}>
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
        <Button variant="secondary" type="button" className={styles.action} onClick={onClose}>
          Cancel
        </Button>
      </div>
      {failure && <ErrorMessage>{failure.message}</ErrorMessage>}
    </form>
  );
}
