"use client";

import { CredentialsSchema, type Credentials } from "@helpmegethired/shared";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import type { CredentialsFormState } from "./actions";

type Field = keyof Credentials;

type FieldMessages = Partial<Record<Field, string>>;

export interface CredentialsFormProps {
  title: string;
  submitLabel: string;
  passwordAutoComplete: "new-password" | "current-password";
  action: (previous: CredentialsFormState, credentials: Credentials) => Promise<CredentialsFormState>;
  alternative: { prompt: string; href: string; label: string };
}

const initialState: CredentialsFormState = { ok: true };

function isField(value: PropertyKey | undefined): value is Field {
  return value === "email" || value === "password";
}

function messagesOf(issues: { path: PropertyKey[]; message: string }[]): FieldMessages {
  const messages: FieldMessages = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (isField(field)) {
      messages[field] ??= issue.message;
    }
  }

  return messages;
}

export function CredentialsForm({ title, submitLabel, passwordAutoComplete, action, alternative }: CredentialsFormProps) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [fieldMessages, setFieldMessages] = useState<FieldMessages>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const parsed = CredentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });

    if (!parsed.success) {
      setFieldMessages(messagesOf(parsed.error.issues));
      return;
    }

    setFieldMessages({});
    startTransition(() => submit(parsed.data));
  }

  return (
    <article className="account-form">
      <h1>{title}</h1>
      <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(fieldMessages.email)}
          aria-describedby={fieldMessages.email ? "email-message" : undefined}
        />
        {fieldMessages.email && (
          <p id="email-message" className="field-message" role="alert">
            {fieldMessages.email}
          </p>
        )}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={passwordAutoComplete}
          aria-invalid={Boolean(fieldMessages.password)}
          aria-describedby={fieldMessages.password ? "password-message" : undefined}
        />
        {fieldMessages.password && (
          <p id="password-message" className="field-message" role="alert">
            {fieldMessages.password}
          </p>
        )}

        {!state.ok && (
          <p className="form-message" role="alert">
            {state.message}
          </p>
        )}

        <button type="submit" disabled={pending}>
          {submitLabel}
        </button>
      </form>
      <p className="muted">
        {alternative.prompt} <Link href={alternative.href}>{alternative.label}</Link>
      </p>
    </article>
  );
}
