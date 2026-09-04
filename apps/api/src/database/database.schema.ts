import type { ColumnType, Generated, Insertable, Selectable } from "kysely";
import type { IngestionStatus, SegmentStatus } from "@helpmegethired/shared";

export interface AccountsTable {
  id: Generated<string>;
  email: string;
  name: string | null;
  last_name: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  address: string | null;
  email_verified_at: Date | null;
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

export interface VerificationTokensTable {
  identifier: string;
  token_hash: string;
  expires_at: Date;
}

export type VerificationTokenRow = Selectable<VerificationTokensTable>;

export interface IngestionsTable {
  id: Generated<string>;
  account_id: string;
  status: IngestionStatus;
  attempts: Generated<number>;
  max_attempts: number;
  last_error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type IngestionRow = Selectable<IngestionsTable>;
export type NewIngestionRow = Insertable<IngestionsTable>;

type JsonColumn = ColumnType<unknown, string, string>;

export interface IngestionSegmentsTable {
  id: Generated<string>;
  ingestion_id: string;
  position: number;
  kind: string;
  status: Generated<SegmentStatus>;
  input: JsonColumn;
  content: JsonColumn | null;
  recognized: JsonColumn | null;
  last_error: string | null;
  updated_at: Generated<Date>;
}

export type IngestionSegmentRow = Selectable<IngestionSegmentsTable>;
export type NewIngestionSegmentRow = Insertable<IngestionSegmentsTable>;

export interface DatabaseSchema {
  accounts: AccountsTable;
  sessions: SessionsTable;
  verification_tokens: VerificationTokensTable;
  ingestions: IngestionsTable;
  ingestion_segments: IngestionSegmentsTable;
}
