"use client";

import { useActionState } from "react";

import { Button } from "../../../../components/atoms/button/button";
import { ErrorMessage } from "../../../../components/atoms/error-message/error-message";
import { TextArea } from "../../../../components/atoms/text-area/text-area";
import { TextInput } from "../../../../components/atoms/text-input/text-input";
import { Field } from "../../../../components/molecules/field/field";
import type { CorrectionAction, CorrectionResult } from "../../../../lib/profile/correction-form";
import styles from "./experience-corrections.module.css";

export interface ExperienceFormValues {
  id: string | null;
  role: string;
  company: string;
  periodStart: string;
  periodEnd: string;
  description: string;
  skills: string;
}

export interface ExperienceFormProps {
  values: ExperienceFormValues;
  legend: string;
  save: CorrectionAction;
  onSaved: () => void;
  onCancel: () => void;
}

const MONTH_HINT = "As 2022-03";

// One role as the Candidate corrects it. A save that the API or the schema refuses leaves the
// form open with what they typed, and says which field it was.
export function ExperienceForm({ values, legend, save, onSaved, onCancel }: ExperienceFormProps) {
  const [result, submit, saving] = useActionState(async (previous: CorrectionResult | null, form: FormData) => {
    const outcome = await save(previous, form);

    if (outcome.ok) {
      onSaved();
    }

    return outcome;
  }, null);

  const issues = result?.ok === false ? (result.issues ?? {}) : {};

  return (
    <li className={styles.entry}>
      <form action={submit} className={styles.form}>
        <fieldset className={styles.fields}>
          <legend className={styles.legend}>{legend}</legend>
          {values.id !== null && <input type="hidden" name="id" value={values.id} />}
          <Field id="role" label="Role" error={issues.role}>
            {(control) => <TextInput {...control} name="role" defaultValue={values.role} />}
          </Field>
          <Field id="company" label="Company" optional error={issues.company}>
            {(control) => <TextInput {...control} name="company" defaultValue={values.company} />}
          </Field>
          <div className={styles.period}>
            <Field id="periodStart" label="From" hint={MONTH_HINT} error={issues["period.start"]}>
              {(control) => <TextInput {...control} name="periodStart" placeholder="2022-03" defaultValue={values.periodStart} />}
            </Field>
            <Field id="periodEnd" label="To" hint="Leave empty if you are still there" optional error={issues["period.end"]}>
              {(control) => <TextInput {...control} name="periodEnd" placeholder="2024-06" defaultValue={values.periodEnd} />}
            </Field>
          </div>
          <Field id="description" label="What you did" optional error={issues.description}>
            {(control) => <TextArea {...control} name="description" rows={3} defaultValue={values.description} />}
          </Field>
          <Field id="skills" label="Skills" hint="Separated by commas" optional error={issues.skills}>
            {(control) => <TextInput {...control} name="skills" defaultValue={values.skills} />}
          </Field>
        </fieldset>
        <div className={styles.actions}>
          <Button type="submit" className={styles.action} disabled={saving}>
            Save
          </Button>
          <Button variant="secondary" type="button" className={styles.action} onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {result?.ok === false && <ErrorMessage>{result.message}</ErrorMessage>}
      </form>
    </li>
  );
}
