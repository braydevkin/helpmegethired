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

export type EmailFormAlternative =
  | { presentation: "button"; prompt: string; label: string; href: string }
  | { presentation: "line"; prompt: string; label: string; href: string };

export interface EmailFormProps {
  eyebrow: string;
  title: string;
  lead: string;
  submitLabel: string;
  alternative: EmailFormAlternative;
  onSubmit: (email: string) => void;
  progress?: StepProgress;
  defaultEmail?: string;
  message?: string;
  pending?: boolean;
}

const EMAIL_FIELD_ID = "email";

export function EmailForm({
  eyebrow,
  title,
  lead,
  submitLabel,
  alternative,
  onSubmit,
  progress,
  defaultEmail,
  message,
  pending = false,
}: EmailFormProps) {
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
      {progress && <ProgressBar {...progress} className={styles.progress} />}
      <ScreenHeading eyebrow={eyebrow} title={title} lead={lead} />
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
          {submitLabel}
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
