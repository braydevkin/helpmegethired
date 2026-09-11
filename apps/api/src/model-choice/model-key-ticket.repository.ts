import { Inject, Injectable } from "@nestjs/common";
import type { Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";

export interface NewModelKeyTicket {
  accountId: Id;
  tokenHash: string;
  expiresAt: Date;
}

export interface TakenModelKeyTicket {
  accountId: Id;
  expiresAt: Date;
}

@Injectable()
export class ModelKeyTicketRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create({ accountId, tokenHash, expiresAt }: NewModelKeyTicket, now: Date): Promise<void> {
    await this.database.deleteFrom("model_key_tickets").where("account_id", "=", accountId).where("expires_at", "<=", now).execute();
    await this.database.insertInto("model_key_tickets").values({ token_hash: tokenHash, account_id: accountId, expires_at: expiresAt }).execute();
  }

  // Deleting and answering in one statement is what makes a ticket single use: of two requests
  // presenting it at once, only one gets the row back.
  async take(tokenHash: string): Promise<TakenModelKeyTicket | undefined> {
    const row = await this.database
      .deleteFrom("model_key_tickets")
      .where("token_hash", "=", tokenHash)
      .returning(["account_id", "expires_at"])
      .executeTakeFirst();

    return row && { accountId: row.account_id, expiresAt: row.expires_at };
  }
}
