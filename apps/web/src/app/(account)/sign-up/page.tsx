import type { Metadata } from "next";

import { SIGN_IN_PATH } from "../../paths";
import { oneTimeCodeAction } from "../actions";
import { OneTimeCodeForm } from "../one-time-code-form";

export const metadata: Metadata = { title: "Sign up | Help Me Get Hired" };

export default function SignUpPage() {
  return (
    <OneTimeCodeForm
      title="Let's get you hired"
      lead="We'll send a 6-digit code to confirm it's really you. No password to remember."
      action={oneTimeCodeAction}
      alternative={{ prompt: "Already have an account?", href: SIGN_IN_PATH, label: "Sign in" }}
    />
  );
}
