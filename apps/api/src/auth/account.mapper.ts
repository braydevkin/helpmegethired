import type { Account } from "@helpmegethired/shared";

import type { AccountRow } from "../database/database.schema";

export type PublicAccountColumns = Pick<AccountRow, "id" | "email" | "created_at">;

export function toAccount(row: PublicAccountColumns): Account {
  return { id: row.id, email: row.email, createdAt: row.created_at.toISOString() };
}
