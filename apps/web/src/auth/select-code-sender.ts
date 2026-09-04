import type { AuthEnvironment } from "../config/auth-environment";
import type { CodeSender } from "./code-sender";
import { DevelopmentCodeSender } from "./development-code-sender";
import { ResendCodeSender } from "./resend-code-sender";

export class MissingCodeSenderError extends Error {
  constructor() {
    super(
      "A production configuration needs an email sender for verification codes: set AUTH_RESEND_KEY and EMAIL_FROM",
    );
    this.name = "MissingCodeSenderError";
  }
}

type SenderEnvironment = Pick<AuthEnvironment, "NODE_ENV" | "AUTH_RESEND_KEY" | "EMAIL_FROM">;

export function selectCodeSender(environment: SenderEnvironment): CodeSender {
  if (environment.AUTH_RESEND_KEY !== undefined && environment.EMAIL_FROM !== undefined) {
    return new ResendCodeSender({ apiKey: environment.AUTH_RESEND_KEY, from: environment.EMAIL_FROM });
  }

  if (environment.NODE_ENV === "production") {
    throw new MissingCodeSenderError();
  }

  return new DevelopmentCodeSender();
}
