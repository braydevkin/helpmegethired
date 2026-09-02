import type { Migration } from "kysely/migration";

import { enableVectorAndCreateAccounts } from "./0001-enable-vector-and-create-accounts";
import { addAccountCredentialsAndSessions } from "./0002-add-account-credentials-and-sessions";
import { createIngestionsAndSegments } from "./0003-create-ingestions-and-segments";

export const migrations: Record<string, Migration> = {
  "0001-enable-vector-and-create-accounts": enableVectorAndCreateAccounts,
  "0002-add-account-credentials-and-sessions": addAccountCredentialsAndSessions,
  "0003-create-ingestions-and-segments": createIngestionsAndSegments,
};
