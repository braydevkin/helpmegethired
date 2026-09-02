import type { Metadata } from "next";

import { SIGN_IN_PATH } from "../../paths";
import { signUpAction } from "../actions";
import { CredentialsForm } from "../credentials-form";

export const metadata: Metadata = { title: "Sign up | Help Me Get Hired" };

export default function SignUpPage() {
  return (
    <CredentialsForm
      title="Create your Account"
      submitLabel="Sign up"
      passwordAutoComplete="new-password"
      action={signUpAction}
      alternative={{ prompt: "Already have an Account?", href: SIGN_IN_PATH, label: "Sign in" }}
    />
  );
}
