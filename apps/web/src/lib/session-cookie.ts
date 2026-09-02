import type { Session } from "@helpmegethired/shared";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  expires: Date;
}

export function sessionCookieOptions(session: Session, environment = process.env.NODE_ENV): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: environment === "production",
    expires: new Date(session.expiresAt),
  };
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function storeSession(session: Session): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, session.token, sessionCookieOptions(session));
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
