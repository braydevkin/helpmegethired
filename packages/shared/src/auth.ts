import { z } from "zod";

import { AccountSchema } from "./account.js";
import { TimestampSchema } from "./primitives.js";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const EmailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

export const PasswordSchema = z
  .string({ error: "Password is required" })
  .min(PASSWORD_MIN_LENGTH, { error: `Password must have at least ${PASSWORD_MIN_LENGTH} characters` })
  .max(PASSWORD_MAX_LENGTH, { error: `Password must have at most ${PASSWORD_MAX_LENGTH} characters` });

export const CredentialsSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export type Credentials = z.infer<typeof CredentialsSchema>;

export const SessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: TimestampSchema,
});

export type Session = z.infer<typeof SessionSchema>;

export const AuthenticatedAccountSchema = z.object({
  account: AccountSchema,
  session: SessionSchema,
});

export type AuthenticatedAccount = z.infer<typeof AuthenticatedAccountSchema>;
