"use client";

import { SendCodeSchema } from "@helpmegethired/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "../../atoms/button/button";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import { TextInput } from "../../atoms/text-input/text-input";
import { Field } from "../../molecules/field/field";
import { LabelledDivider } from "../../molecules/labelled-divider/labelled-divider";
import { ScreenHeading } from "../../molecules/screen-heading/screen-heading";
import styles from "./email-form.module.css";

export interface StepProgress {
  steps: number;
  completed: number;
}

export interface EmailFormStep {
  eyebrow: string;
  progress?: StepProgress;
}

export interface EmailFormCopy {
  title: string;
  lead: string;
  submitLabel: string;
}

export type EmailFormAlternative =
  | { presentation: "button"; prompt: string; label: string; href: string }
  | { presentation: "line"; prompt: string; label: string; href: string };

export interface EmailFormProps {
  step: EmailFormStep;
  copy: EmailFormCopy;
  alternative: EmailFormAlternative;
  onSubmit: (email: string) => void;
  defaultEmail?: string;
  message?: string;
  pending?: boolean;
}

const EMAIL_FIELD_ID = "email";

export function EmailForm({ step, copy, alternative, onSubmit, defaultEmail, message, pending = false }: EmailFormProps) {
  const [fieldError, setFieldError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = SendCodeSchema.safeParse({ email: new FormData(event.currentTarget).get(EMAIL_FIELD_ID) });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);
    onSubmit(parsed.data.email);
  }

  return (
    <div className={styles.screen}>
      {step.progress && <ProgressBar {...step.progress} className={styles.progress} />}
      <ScreenHeading eyebrow={step.eyebrow} title={copy.title} lead={copy.lead} />
      <form onSubmit={handleSubmit} noValidate aria-busy={pending} className={styles.form}>
        <Field id={EMAIL_FIELD_ID} label="Email address" error={fieldError ?? message}>
          {(control) => (
            <TextInput
              {...control}
              name={EMAIL_FIELD_ID}
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              defaultValue={defaultEmail}
              autoFocus
            />
          )}
        </Field>
        <Button type="submit" disabled={pending} className={styles.submit}>
          {copy.submitLabel}
        </Button>
      </form>
      {alternative.presentation === "button" ? (
        <>
          <LabelledDivider label={alternative.prompt} />
          <Button variant="secondary" href={alternative.href}>
            {alternative.label}
          </Button>
        </>
      ) : (
        <p className={styles.footerLine}>
          {alternative.prompt} <Link href={alternative.href}>{alternative.label}</Link>
        </p>
      )}
    </div>
  );
}
