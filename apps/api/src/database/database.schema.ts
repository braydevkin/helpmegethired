import type { Generated, Insertable, Selectable } from "kysely";

export interface AccountsTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  created_at: Generated<Date>;
}

export type AccountRow = Selectable<AccountsTable>;
export type NewAccountRow = Insertable<AccountsTable>;

export interface SessionsTable {
  id: Generated<string>;
  account_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Generated<Date>;
}

export type SessionRow = Selectable<SessionsTable>;
export type NewSessionRow = Insertable<SessionsTable>;

export interface DatabaseSchema {
  accounts: AccountsTable;
  sessions: SessionsTable;
}
