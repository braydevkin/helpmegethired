import type { Migration } from "kysely/migration";

import { enableVectorAndCreateAccounts } from "./0001-enable-vector-and-create-accounts";

export const migrations: Record<string, Migration> = {
  "0001-enable-vector-and-create-accounts": enableVectorAndCreateAccounts,
};
