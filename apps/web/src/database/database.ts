import { Kysely, PostgresDialect, type Generated, type Selectable } from "kysely";
import { Pool } from "pg";

// The tables Auth.js reads and writes. The migrations in apps/api own their shape.
export interface AccountsTable {
  id: Generated<string>;
  email: string;
  name: string | null;
  email_verified_at: Date | null;
  created_at: Generated<Date>;
}

export type AccountRow = Selectable<AccountsTable>;

export interface SessionsTable {
  id: Generated<string>;
  account_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Generated<Date>;
}

export interface VerificationTokensTable {
  identifier: string;
  token_hash: string;
  expires_at: Date;
}

export interface DatabaseSchema {
  accounts: AccountsTable;
  sessions: SessionsTable;
  verification_tokens: VerificationTokensTable;
}

export type Database = Kysely<DatabaseSchema>;

export function createDatabase(connectionString: string): Database {
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}
