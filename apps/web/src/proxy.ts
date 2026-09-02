import { NextResponse, type NextRequest } from "next/server";

import { accountFormPaths, authenticatedPaths, JOURNEY_PATH, SIGN_IN_PATH } from "./app/paths";
import { authClient } from "./lib/auth-client";
import { SESSION_COOKIE } from "./lib/session-cookie";

const startsWithAny = (pathname: string, paths: string[]) => paths.some((path) => pathname.startsWith(path));

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (startsWithAny(pathname, authenticatedPaths) && !token) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  }

  if (startsWithAny(pathname, accountFormPaths) && token) {
    if (await authClient.currentAccount(token)) {
      return NextResponse.redirect(new URL(JOURNEY_PATH, request.url));
    }

    const response = NextResponse.next();

    response.cookies.delete(SESSION_COOKIE);

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/journey", "/sign-in", "/sign-up"],
};
