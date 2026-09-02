import { Inject, Injectable } from "@nestjs/common";
import type { Account, Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import type { AccountRow } from "../database/database.schema";

@Injectable()
export class AccountRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create(email: string): Promise<Account> {
    const row = await this.database
      .insertInto("accounts")
      .values({ email })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toAccount(row);
  }

  async findById(id: Id): Promise<Account | undefined> {
    const row = await this.database.selectFrom("accounts").selectAll().where("id", "=", id).executeTakeFirst();

    return row && toAccount(row);
  }

  async findByEmail(email: string): Promise<Account | undefined> {
    const row = await this.database
      .selectFrom("accounts")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    return row && toAccount(row);
  }
}

function toAccount(row: AccountRow): Account {
  return { id: row.id, email: row.email, createdAt: row.created_at.toISOString() };
}
