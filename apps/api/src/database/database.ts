import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DatabaseSchema } from "./database.schema";

export type Database = Kysely<DatabaseSchema>;

export const DATABASE = Symbol("DATABASE");

export function createDatabase(connectionString: string): Database {
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
  });
}
