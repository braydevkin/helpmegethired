"use client";

import { useState, useTransition } from "react";

import { CodeForm } from "../../../components/organisms/code-form/code-form";
import { EmailForm } from "../../../components/organisms/email-form/email-form";
import { SIGN_UP_PATH } from "../../paths";
import { sendCodeAction, signInWithCodeAction } from "../actions";

type SignInStep = { step: "email"; email?: string } | { step: "code"; email: string; sentAt: number };

const EYEBROW = "Welcome back";

export function SignInFlow() {
  const [state, setState] = useState<SignInStep>({ step: "email" });
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function send(email: string) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await sendCodeAction({ email });

      if (result.ok) {
        setState({ step: "code", email, sentAt: Date.now() });
      } else {
        setMessage(result.message);
      }
    });
  }

  function verify(email: string, code: string) {
    startTransition(async () => {
      const result = await signInWithCodeAction({ email, code });

      if (!result.ok) {
        setMessage(result.message);
      }
    });
  }

  function changeEmail(email: string) {
    setMessage(undefined);
    setState({ step: "email", email });
  }

  if (state.step === "code") {
    return (
      <CodeForm
        delivery={{ email: state.email, sentAt: state.sentAt }}
        step={{ eyebrow: EYEBROW }}
        message={message}
        pending={pending}
        onVerify={(code) => verify(state.email, code)}
        onChangeEmail={() => changeEmail(state.email)}
        onResend={() => send(state.email)}
      />
    );
  }

  return (
    <EmailForm
      step={{ eyebrow: EYEBROW }}
      copy={{
        title: "Sign in to keep going",
        lead: "Enter the email you signed up with and we'll get you straight back in.",
        submitLabel: "Send my code",
      }}
      alternative={{ presentation: "button", prompt: "New here?", label: "Create an account", href: SIGN_UP_PATH }}
      defaultEmail={state.email}
      message={message}
      pending={pending}
      onSubmit={send}
    />
  );
}
