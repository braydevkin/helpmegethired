import { Inject, Injectable } from "@nestjs/common";
import type { Fact, Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import type { FactRow } from "../database/database.schema";

const toFact = (row: FactRow): Fact => ({ id: row.id, kind: row.kind, text: row.text, sourceId: row.source_id });

// What a Job Analysis reads whole beside the retrieved Statements (ADR-0026). Scoped by Account
// in SQL, like every read a later layer makes.
@Injectable()
export class FactRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async ofCuration(accountId: Id, curationId: Id): Promise<Fact[]> {
    const rows = await this.database.selectFrom("facts").selectAll().where("account_id", "=", accountId).where("curation_id", "=", curationId).orderBy("position").execute();

    return rows.map(toFact);
  }
}
