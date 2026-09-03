"use client";

import { AccountInformationSchema, type AccountInformation } from "@helpmegethired/shared";
import { useState, type FormEvent } from "react";

import { Button } from "../../atoms/button/button";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import { TextInput } from "../../atoms/text-input/text-input";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import { Field } from "../../molecules/field/field";
import { PhoneField, type DialCodeOption } from "../../molecules/phone-field/phone-field";
import { ScreenHeading } from "../../molecules/screen-heading/screen-heading";
import { VerifiedEmailField } from "../../molecules/verified-email-field/verified-email-field";
import styles from "./identity-form.module.css";

export interface IdentityFormProps {
  email: string;
  dialCodes: readonly DialCodeOption[];
  defaultDialCode: string;
  onSubmit: (information: AccountInformation) => void;
  message?: string;
  pending?: boolean;
}

type FieldName = "name" | "lastName" | "phone" | "address";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = ["name", "lastName", "phone", "address"];
const PROGRESS = { steps: 3, completed: 3 };

const isFieldName = (value: unknown): value is FieldName => FIELD_NAMES.includes(value as FieldName);

const valueOf = (form: FormData, name: string) => {
  const value = form.get(name);

  return typeof value === "string" ? value : "";
};

export function IdentityForm({ email, dialCodes, defaultDialCode, onSubmit, message, pending = false }: IdentityFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const parsed = AccountInformationSchema.safeParse({
      name: valueOf(form, "name"),
      lastName: valueOf(form, "lastName"),
      phone: { countryCode: valueOf(form, "phoneCountryCode"), number: valueOf(form, "phoneNumber") },
      address: valueOf(form, "address") || null,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const [field] = issue.path;

        if (isFieldName(field)) {
          next[field] ??= issue.message;
        }
      }

      setErrors(next);
      return;
    }

    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <div className={styles.screen} data-card-width="wide">
      <ProgressBar {...PROGRESS} className={styles.progress} />
      <ScreenHeading
        eyebrow="Step 3 of 3"
        title="Tell us who you are"
        lead="This is what recruiters see first, so keep it as it appears on your résumé."
      />
      <form onSubmit={handleSubmit} noValidate aria-busy={pending} className={styles.form}>
        <div className={styles.names}>
          <Field id="name" label="Name" error={errors.name}>
            {(control) => <TextInput {...control} name="name" autoComplete="given-name" placeholder="Ana" density="compact" />}
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName}>
            {(control) => (
              <TextInput {...control} name="lastName" autoComplete="family-name" placeholder="Ferreira" density="compact" />
            )}
          </Field>
        </div>
        <VerifiedEmailField id="email" email={email} />
        <PhoneField
          id="phoneNumber"
          dialCodes={dialCodes}
          defaultDialCode={defaultDialCode}
          dialCodeName="phoneCountryCode"
          numberName="phoneNumber"
          error={errors.phone}
        />
        <Field
          id="address"
          label="Address"
          optional
          hint="Helps us surface roles near you and flag relocation offers."
          error={errors.address}
        >
          {(control) => (
            <TextInput
              {...control}
              name="address"
              autoComplete="street-address"
              placeholder="City, country"
              density="compact"
            />
          )}
        </Field>
        {message && <ErrorMessage>{message}</ErrorMessage>}
        <Button type="submit" disabled={pending} className={styles.submit}>
          Create my account
        </Button>
      </form>
    </div>
  );
}
