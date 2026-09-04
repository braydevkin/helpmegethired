"use client";

import { SendCodeSchema, VERIFICATION_CODE_LENGTH, VerifyCodeSchema } from "@helpmegethired/shared";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";

import type { OneTimeCodeFormInput, OneTimeCodeFormState } from "./actions";

export interface OneTimeCodeFormProps {
  title: string;
  lead: string;
  action: (previous: OneTimeCodeFormState, input: OneTimeCodeFormInput) => Promise<OneTimeCodeFormState>;
  alternative: { prompt: string; href: string; label: string };
}

interface StepProps {
  pending: boolean;
  fieldMessage?: string;
  message?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const initialState: OneTimeCodeFormState = { step: "email" };

export function OneTimeCodeForm({ title, lead, action, alternative }: OneTimeCodeFormProps) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [fieldMessage, setFieldMessage] = useState<string>();

  function dispatch(input: OneTimeCodeFormInput) {
    setFieldMessage(undefined);
    startTransition(() => submit(input));
  }

  function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = SendCodeSchema.safeParse({ email: new FormData(event.currentTarget).get("email") });

    if (parsed.success) {
      dispatch({ kind: "send", request: parsed.data });
    } else {
      setFieldMessage(parsed.error.issues[0]?.message);
    }
  }

  function handleVerifyCode(event: FormEvent<HTMLFormElement>, email: string) {
    event.preventDefault();

    const parsed = VerifyCodeSchema.safeParse({ email, code: new FormData(event.currentTarget).get("code") });

    if (parsed.success) {
      dispatch({ kind: "verify", request: parsed.data });
    } else {
      setFieldMessage(parsed.error.issues[0]?.message);
    }
  }

  const stepProps = { pending, fieldMessage, message: state.message };

  if (state.step === "code") {
    return (
      <CodeStep
        {...stepProps}
        email={state.email}
        onSubmit={(event) => handleVerifyCode(event, state.email)}
        onChangeEmail={() => dispatch({ kind: "change-email" })}
      />
    );
  }

  return <EmailStep {...stepProps} title={title} lead={lead} alternative={alternative} onSubmit={handleSendCode} />;
}

interface EmailStepProps extends StepProps {
  title: string;
  lead: string;
  alternative: OneTimeCodeFormProps["alternative"];
}

function EmailStep({ title, lead, alternative, pending, fieldMessage, message, onSubmit }: EmailStepProps) {
  return (
    <article className="account-form">
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      <form onSubmit={onSubmit} noValidate aria-busy={pending}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          aria-invalid={Boolean(fieldMessage)}
          aria-describedby={fieldMessage ? "email-message" : undefined}
        />
        <StepMessages fieldId="email" fieldMessage={fieldMessage} message={message} />
        <button type="submit" disabled={pending}>
          Send my code
        </button>
      </form>
      <p className="muted">
        {alternative.prompt} <Link href={alternative.href}>{alternative.label}</Link>
      </p>
    </article>
  );
}

interface CodeStepProps extends StepProps {
  email: string;
  onChangeEmail: () => void;
}

function CodeStep({ email, pending, fieldMessage, message, onSubmit, onChangeEmail }: CodeStepProps) {
  return (
    <article className="account-form">
      <h1>Check your inbox</h1>
      <p className="lead">
        We sent a {VERIFICATION_CODE_LENGTH}-digit code to <strong>{email}</strong>. It expires in 10 minutes.
      </p>
      <form onSubmit={onSubmit} noValidate aria-busy={pending}>
        <label htmlFor="code">Verification code</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={VERIFICATION_CODE_LENGTH}
          autoFocus
          aria-invalid={Boolean(fieldMessage)}
          aria-describedby={fieldMessage ? "code-message" : undefined}
        />
        <StepMessages fieldId="code" fieldMessage={fieldMessage} message={message} />
        <button type="submit" disabled={pending}>
          Verify and continue
        </button>
      </form>
      <button type="button" className="link" onClick={onChangeEmail} disabled={pending}>
        Change email
      </button>
    </article>
  );
}

interface StepMessagesProps {
  fieldId: string;
  fieldMessage?: string;
  message?: string;
}

function StepMessages({ fieldId, fieldMessage, message }: StepMessagesProps): ReactNode {
  return (
    <>
      {fieldMessage && (
        <p id={`${fieldId}-message`} className="field-message" role="alert">
          {fieldMessage}
        </p>
      )}
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
    </>
  );
}
