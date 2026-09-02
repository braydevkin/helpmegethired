import type { Generated, Insertable, Selectable } from "kysely";

export interface AccountsTable {
  id: Generated<string>;
  email: string;
  created_at: Generated<Date>;
}

export type AccountRow = Selectable<AccountsTable>;
export type NewAccountRow = Insertable<AccountsTable>;

export interface DatabaseSchema {
  accounts: AccountsTable;
}
