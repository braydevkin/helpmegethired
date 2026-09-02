import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Account } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import type { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./authenticated-request";
import { Public } from "./public.decorator";
import { SessionGuard, bearerTokenOf } from "./session.guard";

const account: Account = { id: crypto.randomUUID(), email: "ada@example.com", createdAt: new Date().toISOString() };
const liveToken = "live-token";

class ProtectedController {
  handler() {}
}

class PublicController {
  @Public()
  handler() {}
}

const authService = {
  authenticate: (token: string) => Promise.resolve(token === liveToken ? account : undefined),
} as Pick<AuthService, "authenticate"> as AuthService;

function contextFor(controller: typeof ProtectedController, authorization?: string) {
  const request = { headers: { authorization } } as Partial<AuthenticatedRequest> as AuthenticatedRequest;
  const context = {
    getHandler: () => controller.prototype.handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

const guard = new SessionGuard(new Reflector(), authService);

describe("bearerTokenOf", () => {
  it.each([
    ["Bearer abc", "abc"],
    ["bearer abc", "abc"],
    ["Basic abc", undefined],
    ["Bearer", undefined],
    ["Bearer abc extra", undefined],
    [undefined, undefined],
  ])("reads %s as %s", (header, token) => {
    expect(bearerTokenOf(header)).toBe(token);
  });
});

describe("SessionGuard", () => {
  it("lets a public handler through without credentials", async () => {
    const { context } = contextFor(PublicController);

    expect(await guard.canActivate(context)).toBe(true);
  });

  it("rejects a protected handler without an Authorization header", async () => {
    const { context } = contextFor(ProtectedController);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a protected handler with a token that has no live Session", async () => {
    const { context } = contextFor(ProtectedController, "Bearer stale-token");

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("exposes the Account and the token on the request for a live Session", async () => {
    const { context, request } = contextFor(ProtectedController, `Bearer ${liveToken}`);

    expect(await guard.canActivate(context)).toBe(true);
    expect(request.account).toEqual(account);
    expect(request.sessionToken).toBe(liveToken);
  });
});
