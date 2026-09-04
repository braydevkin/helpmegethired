import { Auth, createActionURL, raw, skipCSRFCheck } from "@auth/core";
import { Verification } from "@auth/core/errors";
import type { VerifyCodeRequest } from "@helpmegethired/shared";
import { cookies, headers } from "next/headers";

import { JOURNEY_PATH } from "../app/paths";
import { authRuntime } from "./auth";
import { EMAIL_CODE_PROVIDER_ID } from "./email-code-provider";

export class CodeNotSentError extends Error {
  constructor() {
    super("The verification code could not be sent");
    this.name = "CodeNotSentError";
  }
}

export async function sendCode(email: string): Promise<void> {
  const outcome = await authRuntime().signIn(EMAIL_CODE_PROVIDER_ID, {
    email,
    redirect: false,
    redirectTo: JOURNEY_PATH,
  });

  if (typeof outcome !== "string" || outcome.includes("error=")) {
    throw new CodeNotSentError();
  }
}

// Verifying the code in-process keeps it out of the browser's URL and lets the
// form report a wrong or expired code inline instead of following a redirect.
export async function verifyCode({ email, code }: VerifyCodeRequest): Promise<boolean> {
  const { config } = authRuntime();
  const requestHeaders = new Headers(await headers());
  const callbackUrl = createActionURL(
    "callback",
    requestHeaders.get("x-forwarded-proto") ?? "http",
    requestHeaders,
    process.env,
    config,
  );
  const url = new URL(`${callbackUrl}/${EMAIL_CODE_PROVIDER_ID}`);

  url.searchParams.set("token", code);
  url.searchParams.set("email", email);
  url.searchParams.set("callbackUrl", JOURNEY_PATH);

  try {
    const response = await Auth(new Request(url, { headers: requestHeaders }), {
      ...config,
      raw,
      skipCSRFCheck,
    });
    const cookieJar = await cookies();

    for (const cookie of response.cookies ?? []) {
      cookieJar.set(cookie.name, cookie.value, cookie.options);
    }

    return true;
  } catch (error) {
    if (error instanceof Verification) {
      return false;
    }

    throw error;
  }
}
