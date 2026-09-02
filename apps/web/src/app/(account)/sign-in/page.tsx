import type { Metadata } from "next";

import { SIGN_UP_PATH } from "../../paths";
import { signInAction } from "../actions";
import { CredentialsForm } from "../credentials-form";

export const metadata: Metadata = { title: "Sign in | Help Me Get Hired" };

export default function SignInPage() {
  return (
    <CredentialsForm
      title="Sign in"
      submitLabel="Sign in"
      passwordAutoComplete="current-password"
      action={signInAction}
      alternative={{ prompt: "New here?", href: SIGN_UP_PATH, label: "Create an Account" }}
    />
  );
}
