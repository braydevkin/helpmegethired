import type { AuthEnvironment } from "../config/auth-environment";
import type { CodeSender } from "./code-sender";
import { DevelopmentCodeSender } from "./development-code-sender";

export class MissingCodeSenderError extends Error {
  constructor() {
    super("A production configuration needs an email sender for verification codes; none is configured");
    this.name = "MissingCodeSenderError";
  }
}

export function selectCodeSender(environment: Pick<AuthEnvironment, "NODE_ENV">): CodeSender {
  if (environment.NODE_ENV === "production") {
    throw new MissingCodeSenderError();
  }

  return new DevelopmentCodeSender();
}
