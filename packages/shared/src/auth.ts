import { z } from "zod";

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_LIFETIME_SECONDS = 10 * 60;
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

export const EmailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

export const SendCodeSchema = z.object({
  email: EmailSchema,
});

export type SendCodeRequest = z.infer<typeof SendCodeSchema>;

const verificationCodePattern = new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`);

export const VerificationCodeSchema = z
  .string({ error: "Code is required" })
  .trim()
  .regex(verificationCodePattern, { error: `Enter all ${VERIFICATION_CODE_LENGTH} digits of your code` });

export const VerifyCodeSchema = z.object({
  email: EmailSchema,
  code: VerificationCodeSchema,
});

export type VerifyCodeRequest = z.infer<typeof VerifyCodeSchema>;
