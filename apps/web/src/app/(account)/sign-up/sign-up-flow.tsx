"use client";

import type { AccountInformation } from "@helpmegethired/shared";
import { useState, useTransition } from "react";

import type { DialCodeOption } from "../../../components/molecules/phone-field/phone-field";
import { CodeForm } from "../../../components/organisms/code-form/code-form";
import { DoneCard } from "../../../components/organisms/done-card/done-card";
import { EmailForm } from "../../../components/organisms/email-form/email-form";
import { IdentityForm } from "../../../components/organisms/identity-form/identity-form";
import { JOURNEY_PATH, SIGN_IN_PATH } from "../../paths";
import { saveAccountInformationAction, sendCodeAction, verifyCodeAction, type ActionResult } from "../actions";
import type { SignUpStart } from "./sign-up-start";

type SignUpStep = SignUpStart | { step: "email"; email: string } | { step: "done"; name: string };

export interface SignUpFlowProps {
  start: SignUpStart;
  dialCodes: readonly DialCodeOption[];
  defaultDialCode: string;
}

const STEPS = 3;

function useSignUpFlow(start: SignUpStart) {
  const [state, setState] = useState<SignUpStep>(start);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function attempt(request: () => Promise<ActionResult>, next: () => SignUpStep) {
    startTransition(async () => {
      const result = await request();

      if (result.ok) {
        setMessage(undefined);
        setState(next());
      } else {
        setMessage(result.message);
      }
    });
  }

  function send(email: string) {
    setMessage(undefined);
    attempt(() => sendCodeAction({ email }), () => ({ step: "code", email, sentAt: Date.now() }));
  }

  function verify(email: string, code: string) {
    attempt(() => verifyCodeAction({ email, code }), () => ({ step: "identity", email }));
  }

  function save(information: AccountInformation) {
    setMessage(undefined);
    attempt(() => saveAccountInformationAction(information), () => ({ step: "done", name: information.name }));
  }

  function changeEmail(email: string) {
    setMessage(undefined);
    setState({ step: "email", email });
  }

  return { state, message, pending, send, verify, save, changeEmail };
}

export function SignUpFlow({ start, dialCodes, defaultDialCode }: SignUpFlowProps) {
  const { state, message, pending, send, verify, save, changeEmail } = useSignUpFlow(start);

  switch (state.step) {
    case "code":
      return (
        <CodeForm
          delivery={{ email: state.email, sentAt: state.sentAt }}
          step={{ eyebrow: "Step 2 of 3", progress: { steps: STEPS, completed: 2 } }}
          message={message}
          pending={pending}
          onVerify={(code) => verify(state.email, code)}
          onChangeEmail={() => changeEmail(state.email)}
          onResend={() => send(state.email)}
        />
      );
    case "identity":
      return (
        <IdentityForm
          email={state.email}
          dialCodes={dialCodes}
          defaultDialCode={defaultDialCode}
          message={message}
          pending={pending}
          onSubmit={save}
        />
      );
    case "done":
      return <DoneCard name={state.name} journeyHref={JOURNEY_PATH} />;
    case "email":
      return (
        <EmailForm
          step={{ eyebrow: "Step 1 of 3", progress: { steps: STEPS, completed: 1 } }}
          copy={{
            title: "Let's get you hired",
            lead: "We'll send a 6-digit code to confirm it's really you. No password to remember.",
            submitLabel: "Send my code",
          }}
          alternative={{ presentation: "line", prompt: "Already have an account?", label: "Sign in", href: SIGN_IN_PATH }}
          defaultEmail={"email" in state ? state.email : undefined}
          message={message}
          pending={pending}
          onSubmit={send}
        />
      );
  }
}
