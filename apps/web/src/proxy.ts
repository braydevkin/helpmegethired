import { NextResponse, type NextRequest } from "next/server";

import { accountFormPaths, authenticatedPaths, JOURNEY_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "./app/paths";
import { authClient } from "./lib/auth-client";
import { SESSION_COOKIE } from "./lib/session-cookie";

const startsWithAny = (pathname: string, paths: string[]) => paths.some((path) => pathname.startsWith(path));

const redirectTo = (path: string, request: NextRequest) => NextResponse.redirect(new URL(path, request.url));

const withoutSession = (response: NextResponse) => {
  response.cookies.delete(SESSION_COOKIE);

  return response;
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthenticatedPath = startsWithAny(pathname, authenticatedPaths);
  const isAccountFormPath = startsWithAny(pathname, accountFormPaths);

  if (!token) {
    return isAuthenticatedPath ? redirectTo(SIGN_IN_PATH, request) : NextResponse.next();
  }

  const account = await authClient.currentAccount(token);

  if (!account) {
    return withoutSession(isAuthenticatedPath ? redirectTo(SIGN_IN_PATH, request) : NextResponse.next());
  }

  // An Account without a name has verified its email but not finished signing up:
  // every path leads back to the account information step (design open point 11).
  if (!account.name) {
    return pathname.startsWith(SIGN_UP_PATH) ? NextResponse.next() : redirectTo(SIGN_UP_PATH, request);
  }

  return isAccountFormPath ? redirectTo(JOURNEY_PATH, request) : NextResponse.next();
}

export const config = {
  matcher: ["/journey", "/sign-in", "/sign-up"],
};
