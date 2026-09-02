import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./authenticated-request";
import { IS_PUBLIC } from "./public.decorator";

const BEARER_SCHEME = "bearer";

export function bearerTokenOf(authorization: string | undefined): string | undefined {
  const [scheme, token, ...rest] = authorization?.split(" ") ?? [];

  return scheme?.toLowerCase() === BEARER_SCHEME && token && rest.length === 0 ? token : undefined;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerTokenOf(request.headers.authorization);
    const account = token ? await this.authService.authenticate(token) : undefined;

    if (!token || !account) {
      throw new UnauthorizedException("A valid session is required");
    }

    request.account = account;
    request.sessionToken = token;

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]) === true;
  }
}
