"use client";

import { SendCodeSchema, VERIFICATION_CODE_LENGTH, VerifyCodeSchema } from "@helpmegethired/shared";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import type { OneTimeCodeFormInput, OneTimeCodeFormState } from "./actions";

export interface OneTimeCodeFormProps {
  title: string;
  lead: string;
  action: (previous: OneTimeCodeFormState, input: OneTimeCodeFormInput) => Promise<OneTimeCodeFormState>;
  alternative: { prompt: string; href: string; label: string };
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

    if (!parsed.success) {
      setFieldMessage(parsed.error.issues[0]?.message);
      return;
    }

    dispatch({ kind: "send", request: parsed.data });
  }

  function handleVerifyCode(event: FormEvent<HTMLFormElement>, email: string) {
    event.preventDefault();

    const parsed = VerifyCodeSchema.safeParse({ email, code: new FormData(event.currentTarget).get("code") });

    if (!parsed.success) {
      setFieldMessage(parsed.error.issues[0]?.message);
      return;
    }

    dispatch({ kind: "verify", request: parsed.data });
  }

  if (state.step === "code") {
    return (
      <article className="account-form">
        <h1>Check your inbox</h1>
        <p className="lead">
          We sent a {VERIFICATION_CODE_LENGTH}-digit code to <strong>{state.email}</strong>. It expires in 10
          minutes.
        </p>
        <form onSubmit={(event) => handleVerifyCode(event, state.email)} noValidate aria-busy={pending}>
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
          {fieldMessage && (
            <p id="code-message" className="field-message" role="alert">
              {fieldMessage}
            </p>
          )}
          {state.message && (
            <p className="form-message" role="alert">
              {state.message}
            </p>
          )}
          <button type="submit" disabled={pending}>
            Verify and continue
          </button>
        </form>
        <button type="button" className="link" onClick={() => dispatch({ kind: "change-email" })} disabled={pending}>
          Change email
        </button>
      </article>
    );
  }

  return (
    <article className="account-form">
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      <form onSubmit={handleSendCode} noValidate aria-busy={pending}>
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
        {fieldMessage && (
          <p id="email-message" className="field-message" role="alert">
            {fieldMessage}
          </p>
        )}
        {state.message && (
          <p className="form-message" role="alert">
            {state.message}
          </p>
        )}
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
