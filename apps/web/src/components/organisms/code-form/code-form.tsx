"use client";

import { VERIFICATION_CODE_LENGTH, VERIFICATION_CODE_LIFETIME_SECONDS, VerifyCodeSchema } from "@helpmegethired/shared";
import { useState, type FormEvent } from "react";

import { Button } from "../../atoms/button/button";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import { CodeInput } from "../../molecules/code-input/code-input";
import { ResendCountdown } from "../../molecules/resend-countdown/resend-countdown";
import { ScreenHeading } from "../../molecules/screen-heading/screen-heading";
import styles from "./code-form.module.css";

export interface CodeFormProgress {
  steps: number;
  completed: number;
}

export interface CodeFormStep {
  eyebrow: string;
  progress?: CodeFormProgress;
}

export interface CodeDelivery {
  email: string;
  sentAt: number;
}

export interface CodeFormProps {
  delivery: CodeDelivery;
  step: CodeFormStep;
  onVerify: (code: string) => void;
  onChangeEmail: () => void;
  onResend: () => void;
  message?: string;
  pending?: boolean;
}

const CODE_FIELD_NAME = "code";
const CODE_LIFETIME_MINUTES = VERIFICATION_CODE_LIFETIME_SECONDS / 60;

export function CodeForm({ delivery, step, onVerify, onChangeEmail, onResend, message, pending = false }: CodeFormProps) {
  const [fieldError, setFieldError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = VerifyCodeSchema.safeParse({
      email: delivery.email,
      code: new FormData(event.currentTarget).get(CODE_FIELD_NAME),
    });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }

    setFieldError(undefined);
    onVerify(parsed.data.code);
  }

  return (
    <div className={styles.screen}>
      {step.progress && <ProgressBar {...step.progress} className={styles.progress} />}
      <ScreenHeading
        eyebrow={step.eyebrow}
        title="Check your inbox"
        lead={
          <>
            We sent a {VERIFICATION_CODE_LENGTH}-digit code to <strong>{delivery.email}</strong>. It expires in{" "}
            {CODE_LIFETIME_MINUTES} minutes.
          </>
        }
      />
      <form onSubmit={handleSubmit} noValidate aria-busy={pending} className={styles.form}>
        <CodeInput
          key={`${delivery.sentAt}-${message ?? ""}`}
          name={CODE_FIELD_NAME}
          length={VERIFICATION_CODE_LENGTH}
          error={fieldError ?? message}
          autoFocus
        />
        <Button type="submit" disabled={pending} className={styles.submit}>
          Verify and continue
        </Button>
      </form>
      <div className={styles.actions}>
        <button type="button" onClick={onChangeEmail} disabled={pending} className={styles["change-email"]}>
          <span aria-hidden="true">← </span>Change email
        </button>
        <ResendCountdown sentAt={delivery.sentAt} onResend={onResend} disabled={pending} />
      </div>
    </div>
  );
}
