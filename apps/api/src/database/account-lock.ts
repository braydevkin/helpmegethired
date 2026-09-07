import type { Id } from "@helpmegethired/shared";

import type { Database } from "./database";

// Rules that span tables, such as one active upload or Ingestion per Account, serialise on
// the Account row so two transactions cannot both pass their checks.
export async function lockAccount(accountId: Id, transaction: Database): Promise<void> {
  await transaction.selectFrom("accounts").select("id").where("id", "=", accountId).forUpdate().execute();
}
