import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Account } from "@helpmegethired/shared";

import type { AuthenticatedRequest } from "./authenticated-request";

const requestOf = (context: ExecutionContext) => context.switchToHttp().getRequest<AuthenticatedRequest>();

export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Account => requestOf(context).account,
);

export const CurrentSessionToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => requestOf(context).sessionToken,
);
