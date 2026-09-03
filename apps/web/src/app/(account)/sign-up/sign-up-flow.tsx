"use client";

import type { AccountInformation } from "@helpmegethired/shared";
import { useState, useTransition } from "react";

import type { DialCodeOption } from "../../../components/molecules/phone-field/phone-field";
import { CodeForm } from "../../../components/organisms/code-form/code-form";
import { DoneCard } from "../../../components/organisms/done-card/done-card";
import { EmailForm } from "../../../components/organisms/email-form/email-form";
import { IdentityForm } from "../../../components/organisms/identity-form/identity-form";
import { JOURNEY_PATH, SIGN_IN_PATH } from "../../paths";
import { saveAccountInformationAction, sendCodeAction, verifyCodeAction } from "../actions";
import type { SignUpStart } from "./sign-up-start";

type SignUpStep = SignUpStart | { step: "email"; email: string } | { step: "done"; name: string };

export interface SignUpFlowProps {
  start: SignUpStart;
  dialCodes: readonly DialCodeOption[];
  defaultDialCode: string;
}

const STEPS = 3;

export function SignUpFlow({ start, dialCodes, defaultDialCode }: SignUpFlowProps) {
  const [state, setState] = useState<SignUpStep>(start);
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
      const result = await verifyCodeAction({ email, code });

      if (result.ok) {
        setMessage(undefined);
        setState({ step: "identity", email });
      } else {
        setMessage(result.message);
      }
    });
  }

  function save(information: AccountInformation) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await saveAccountInformationAction(information);

      if (result.ok) {
        setState({ step: "done", name: information.name });
      } else {
        setMessage(result.message);
      }
    });
  }

  function changeEmail(email: string) {
    setMessage(undefined);
    setState({ step: "email", email });
  }

  switch (state.step) {
    case "code":
      return (
        <CodeForm
          email={state.email}
          eyebrow="Step 2 of 3"
          progress={{ steps: STEPS, completed: 2 }}
          sentAt={state.sentAt}
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
          eyebrow="Step 1 of 3"
          title="Let's get you hired"
          lead="We'll send a 6-digit code to confirm it's really you. No password to remember."
          submitLabel="Send my code"
          progress={{ steps: STEPS, completed: 1 }}
          alternative={{ presentation: "line", prompt: "Already have an account?", label: "Sign in", href: SIGN_IN_PATH }}
          defaultEmail={"email" in state ? state.email : undefined}
          message={message}
          pending={pending}
          onSubmit={send}
        />
      );
  }
}
