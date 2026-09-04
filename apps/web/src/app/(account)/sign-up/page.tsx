import { DEFAULT_DIAL_CODE } from "@helpmegethired/shared";
import type { Metadata } from "next";

import { dialCodeOptions } from "./dial-codes";
import { SignUpFlow } from "./sign-up-flow";
import { signUpStart } from "./sign-up-start";

export const metadata: Metadata = { title: "Sign up | Help Me Get Hired" };

export default async function SignUpPage() {
  const start = await signUpStart();

  return <SignUpFlow start={start} dialCodes={dialCodeOptions} defaultDialCode={DEFAULT_DIAL_CODE} />;
}
