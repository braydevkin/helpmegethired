import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Account, AccountInformation } from "@helpmegethired/shared";

import { AccountRepository } from "./account.repository";
import { SessionRepository } from "./session.repository";
import { hashSessionToken } from "./session-token";

@Injectable()
export class AuthService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
  ) {}

  authenticate(token: string): Promise<Account | undefined> {
    return this.sessions.findAccountByTokenHash(hashSessionToken(token), new Date());
  }

  signOut(token: string): Promise<void> {
    return this.sessions.deleteByTokenHash(hashSessionToken(token));
  }

  async updateInformation(account: Account, information: AccountInformation): Promise<Account> {
    const updated = await this.accounts.updateInformation(account.id, information);

    if (!updated) {
      throw new UnauthorizedException("A valid session is required");
    }

    return updated;
  }
}
