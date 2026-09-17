import { Inject, Injectable } from "@nestjs/common";
import type { Id } from "@helpmegethired/shared";
import { sql } from "kysely";

import { lockAccount } from "../database/account-lock";
import { DATABASE, type Database } from "../database/database";
import { DEFAULT_DAILY_EMBEDDING_TOKENS } from "./embedding-allowance";

// Every method takes the Account first, so another Account's usage and ceiling answer as absent.
@Injectable()
export class EmbeddingAllowanceRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Checked and counted in one transaction under the Account lock, so two reservations for one
  // Account run one after the other and the counter never passes the ceiling.
  reserve(accountId: Id, tokens: number, period: string): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      await lockAccount(accountId, transaction);

      const ceiling = await this.ceilingOf(accountId, transaction);
      const used = await this.usedIn(accountId, period, transaction);

      if (used + tokens > ceiling) {
        return false;
      }

      await transaction
        .insertInto("embedding_usage")
        .values({ account_id: accountId, period_start: period, tokens })
        .onConflict((conflict) =>
          conflict.columns(["account_id", "period_start"]).doUpdateSet({ tokens: sql<number>`embedding_usage.tokens + excluded.tokens`, updated_at: sql<Date>`now()` }),
        )
        .execute();

      return true;
    });
  }

  async usedIn(accountId: Id, period: string, database: Database = this.database): Promise<number> {
    const row = await database.selectFrom("embedding_usage").select("tokens").where("account_id", "=", accountId).where("period_start", "=", period).executeTakeFirst();

    return row?.tokens ?? 0;
  }

  async ceilingOf(accountId: Id, database: Database = this.database): Promise<number> {
    const row = await database.selectFrom("embedding_ceiling_overrides").select("tokens_per_day").where("account_id", "=", accountId).executeTakeFirst();

    return row?.tokens_per_day ?? DEFAULT_DAILY_EMBEDDING_TOKENS;
  }
}
