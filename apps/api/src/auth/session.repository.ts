import { Inject, Injectable } from "@nestjs/common";
import type { Account, Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { toAccount } from "./account.mapper";

export interface NewSession {
  accountId: Id;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create({ accountId, tokenHash, expiresAt }: NewSession): Promise<void> {
    await this.database
      .insertInto("sessions")
      .values({ account_id: accountId, token_hash: tokenHash, expires_at: expiresAt })
      .execute();
  }

  async findAccountByTokenHash(tokenHash: string, now: Date): Promise<Account | undefined> {
    const row = await this.database
      .selectFrom("sessions")
      .innerJoin("accounts", "accounts.id", "sessions.account_id")
      .select(["accounts.id", "accounts.email", "accounts.created_at"])
      .where("sessions.token_hash", "=", tokenHash)
      .where("sessions.expires_at", ">", now)
      .executeTakeFirst();

    return row && toAccount(row);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.database.deleteFrom("sessions").where("token_hash", "=", tokenHash).execute();
  }
}
