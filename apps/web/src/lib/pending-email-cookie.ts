import { EmailSchema, VERIFICATION_CODE_LIFETIME_SECONDS } from "@helpmegethired/shared";
import { cookies } from "next/headers";
import { z } from "zod";

export const PENDING_EMAIL_COOKIE = "pending-email";

const PendingEmailSchema = z.object({
  email: EmailSchema,
  sentAt: z.number().int().positive(),
});

export type PendingEmail = z.infer<typeof PendingEmailSchema>;

export function pendingEmailCookieOptions(environment = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: environment === "production",
    maxAge: VERIFICATION_CODE_LIFETIME_SECONDS,
  };
}

// The email a code was just sent to survives a reload of the code step for as
// long as the code itself is valid (design open point 11).
export async function rememberPendingEmail(email: string): Promise<PendingEmail> {
  const pending: PendingEmail = { email, sentAt: Date.now() };

  (await cookies()).set(PENDING_EMAIL_COOKIE, JSON.stringify(pending), pendingEmailCookieOptions());

  return pending;
}

export async function readPendingEmail(): Promise<PendingEmail | undefined> {
  const raw = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = PendingEmailSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function forgetPendingEmail(): Promise<void> {
  (await cookies()).delete(PENDING_EMAIL_COOKIE);
}
