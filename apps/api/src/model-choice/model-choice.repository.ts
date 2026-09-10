import { Inject, Injectable } from "@nestjs/common";
import type { Id, ModelId, Provider } from "@helpmegethired/shared";
import { sql } from "kysely";

import { DATABASE, type Database } from "../database/database";

export interface StoredModelChoice {
  provider: Provider;
  modelId: ModelId;
  sealedKey: Buffer | null;
}

export interface NewModelChoice {
  provider: Provider;
  modelId: ModelId;
  sealedKey: Buffer;
}

const columns = ["provider", "model_id", "sealed_key"] as const;

const toStored = (row: { provider: Provider; model_id: ModelId; sealed_key: Buffer | null }): StoredModelChoice => ({
  provider: row.provider,
  modelId: row.model_id,
  sealedKey: row.sealed_key,
});

@Injectable()
export class ModelChoiceRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async find(accountId: Id): Promise<StoredModelChoice | undefined> {
    const row = await this.database.selectFrom("account_model_choices").select(columns).where("account_id", "=", accountId).executeTakeFirst();

    return row && toStored(row);
  }

  async save(accountId: Id, choice: NewModelChoice): Promise<StoredModelChoice> {
    const values = { provider: choice.provider, model_id: choice.modelId, sealed_key: choice.sealedKey };
    const row = await this.database
      .insertInto("account_model_choices")
      .values({ account_id: accountId, ...values })
      .onConflict((conflict) => conflict.column("account_id").doUpdateSet({ ...values, updated_at: sql`now()` }))
      .returning(columns)
      .executeTakeFirstOrThrow();

    return toStored(row);
  }

  async revokeKey(accountId: Id): Promise<StoredModelChoice | undefined> {
    const row = await this.database
      .updateTable("account_model_choices")
      .set({ sealed_key: null, updated_at: sql`now()` })
      .where("account_id", "=", accountId)
      .returning(columns)
      .executeTakeFirst();

    return row && toStored(row);
  }
}
