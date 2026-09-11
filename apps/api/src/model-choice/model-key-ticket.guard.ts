import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Account } from "@helpmegethired/shared";
import type { Request } from "express";

import { AccountRepository } from "../auth/account.repository";
import { bearerTokenOf } from "../auth/session.guard";
import { ModelKeyTicketInvalidError } from "./model-choice-errors";
import { ModelKeyTicketService } from "./model-key-ticket.service";

type TicketRequest = Request & { account?: Account };

@Injectable()
export class ModelKeyTicketGuard implements CanActivate {
  constructor(
    private readonly tickets: ModelKeyTicketService,
    private readonly accounts: AccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TicketRequest>();

    if (request.account) {
      return true;
    }

    const ticket = bearerTokenOf(request.headers.authorization);

    if (!ticket) {
      throw new ModelKeyTicketInvalidError();
    }

    const account = await this.accounts.findById(await this.tickets.redeem(ticket));

    if (!account) {
      throw new ModelKeyTicketInvalidError();
    }

    request.account = account;

    return true;
  }
}
