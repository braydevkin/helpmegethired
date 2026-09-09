import { VERIFICATION_CODE_LIFETIME_SECONDS } from "@helpmegethired/shared";
import type { EmailConfig } from "next-auth/providers";

import type { CodeSender } from "./code-sender";
import { generateVerificationCode } from "./verification-code";

export const EMAIL_CODE_PROVIDER_ID = "email-code";

export function emailCodeProvider(sender: CodeSender): EmailConfig {
  return {
    id: EMAIL_CODE_PROVIDER_ID,
    type: "email",
    name: "Email code",
    maxAge: VERIFICATION_CODE_LIFETIME_SECONDS,
    generateVerificationToken: generateVerificationCode,
    sendVerificationRequest: ({ identifier, token, expires }) =>
      sender.send({ email: identifier, code: token, expiresAt: expires }),
    options: {},
  };
}
