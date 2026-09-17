import type { Migration } from "kysely/migration";

import { enableVectorAndCreateAccounts } from "./0001-enable-vector-and-create-accounts";
import { addAccountCredentialsAndSessions } from "./0002-add-account-credentials-and-sessions";
import { createIngestionsAndSegments } from "./0003-create-ingestions-and-segments";
import { replacePasswordsWithOneTimeCodes } from "./0004-replace-passwords-with-one-time-codes";
import { createUploadedResumes } from "./0005-create-uploaded-resumes";
import { createProfileTables } from "./0006-create-profile-tables";
import { createCurationTables } from "./0007-create-curation-tables";
import { createAccountModelChoices } from "./0008-create-account-model-choices";
import { createModelKeyTickets } from "./0009-create-model-key-tickets";
import { createEmbeddingAllowances } from "./0010-create-embedding-allowances";
import { allowCandidateCorrections } from "./0011-allow-candidate-corrections";

export const migrations: Record<string, Migration> = {
  "0001-enable-vector-and-create-accounts": enableVectorAndCreateAccounts,
  "0002-add-account-credentials-and-sessions": addAccountCredentialsAndSessions,
  "0003-create-ingestions-and-segments": createIngestionsAndSegments,
  "0004-replace-passwords-with-one-time-codes": replacePasswordsWithOneTimeCodes,
  "0005-create-uploaded-resumes": createUploadedResumes,
  "0006-create-profile-tables": createProfileTables,
  "0007-create-curation-tables": createCurationTables,
  "0008-create-account-model-choices": createAccountModelChoices,
  "0009-create-model-key-tickets": createModelKeyTickets,
  "0010-create-embedding-allowances": createEmbeddingAllowances,
  "0011-allow-candidate-corrections": allowCandidateCorrections,
};
