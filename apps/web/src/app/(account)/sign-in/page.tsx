import type { Metadata } from "next";

import { SIGN_UP_PATH } from "../../paths";
import { oneTimeCodeAction } from "../actions";
import { OneTimeCodeForm } from "../one-time-code-form";

export const metadata: Metadata = { title: "Sign in | Help Me Get Hired" };

export default function SignInPage() {
  return (
    <OneTimeCodeForm
      title="Sign in to keep going"
      lead="Enter the email you signed up with and we'll get you straight back in."
      action={oneTimeCodeAction}
      alternative={{ prompt: "New here?", href: SIGN_UP_PATH, label: "Create an account" }}
    />
  );
}
