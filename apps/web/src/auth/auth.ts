import { SESSION_LIFETIME_SECONDS } from "@helpmegethired/shared";
import NextAuth, { type NextAuthConfig, type NextAuthResult } from "next-auth";

import { SIGN_IN_PATH } from "../app/paths";
import { readAuthEnvironment } from "../config/auth-environment";
import { createDatabase } from "../database/database";
import { globalSingleton } from "../lib/global-singleton";
import { SESSION_COOKIE, sessionCookieOptions } from "../lib/session-cookie";
import { createAccountAdapter } from "./account-adapter";
import { emailCodeProvider } from "./email-code-provider";
import { selectCodeSender } from "./select-code-sender";

export interface AuthRuntime {
  config: NextAuthConfig;
  auth: NextAuthResult["auth"];
  signIn: NextAuthResult["signIn"];
}

function createAuthRuntime(): AuthRuntime {
  const environment = readAuthEnvironment();
  const database = createDatabase(environment.DATABASE_URL);

  const config: NextAuthConfig = {
    adapter: createAccountAdapter(database),
    providers: [emailCodeProvider(selectCodeSender(environment))],
    secret: environment.AUTH_SECRET,
    session: {
      strategy: "database",
      maxAge: SESSION_LIFETIME_SECONDS,
      updateAge: SESSION_LIFETIME_SECONDS,
    },
    cookies: {
      sessionToken: { name: SESSION_COOKIE, options: sessionCookieOptions(environment.NODE_ENV) },
    },
    pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
    trustHost: true,
  };

  const { auth, signIn } = NextAuth(config);

  return { config, auth, signIn };
}

// Built on first use, not on import, so `next build` can collect page data
// without the runtime environment.
export const authRuntime = (): AuthRuntime => globalSingleton("auth-runtime", createAuthRuntime);
