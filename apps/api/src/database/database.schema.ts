import type { ColumnType, Generated, Insertable, Selectable } from "kysely";
import type {
  CurationFailureReason,
  CurationStatus,
  CurationUnitFailureReason,
  CurationUnitKind,
  CurationUnitStatus,
  IngestionSource,
  IngestionStatus,
  ResumeUploadErrorCode,
  SegmentStatus,
  SkillCategory,
  StatementReviewState,
  UploadedResumeStatus,
} from "@helpmegethired/shared";

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
  source: IngestionSource;
  status: IngestionStatus;
  attempts: Generated<number>;
  max_attempts: number;
  last_error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  completed_at: Date | null;
}

export type IngestionRow = Selectable<IngestionsTable>;
export type NewIngestionRow = Insertable<IngestionsTable>;

type JsonColumn = ColumnType<unknown, string, string>;
type DefaultedJsonColumn = ColumnType<unknown, string | undefined, string>;

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

export interface UploadedResumesTable {
  id: string;
  account_id: string;
  sha256: string;
  file_name: string;
  size_bytes: number;
  object_key: string;
  status: Generated<UploadedResumeStatus>;
  error_code: ResumeUploadErrorCode | null;
  error_message: string | null;
  raw_text: string | null;
  extractor_version: string | null;
  attempts: Generated<number>;
  max_attempts: number;
  ingestion_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  finished_at: Date | null;
}

export type UploadedResumeRow = Selectable<UploadedResumesTable>;
export type NewUploadedResumeRow = Insertable<UploadedResumesTable>;

interface ProfileRowColumns {
  id: Generated<string>;
  account_id: string;
  source_ingestion_id: string;
  segment_id: string;
  created_at: Generated<Date>;
}

interface OrderedProfileRowColumns extends ProfileRowColumns {
  segment_position: number;
  position: number;
}

interface PeriodColumns {
  period_start: string | null;
  period_end: string | null;
}

export interface BasicProfilesTable extends ProfileRowColumns {
  headline: string | null;
  summary: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  confirmed_at: Date | null;
}

export interface ExperiencesTable extends OrderedProfileRowColumns, PeriodColumns {
  company: string | null;
  role: string;
  description: string | null;
  skills: JsonColumn;
}

export interface EducationTable extends OrderedProfileRowColumns, PeriodColumns {
  institution: string;
  degree: string | null;
  field_of_study: string | null;
}

export interface ProjectsTable extends OrderedProfileRowColumns {
  name: string;
  description: string | null;
  url: string | null;
  skills: JsonColumn;
}

export interface SkillsTable extends OrderedProfileRowColumns {
  name: string;
  category: SkillCategory;
}

export interface LanguagesTable extends OrderedProfileRowColumns {
  name: string;
  level: string | null;
}

export interface CertificationsTable extends OrderedProfileRowColumns {
  name: string;
  issuer: string | null;
  year: number | null;
}

export type BasicProfileRow = Selectable<BasicProfilesTable>;
export type ExperienceRow = Selectable<ExperiencesTable>;
export type EducationRow = Selectable<EducationTable>;
export type ProjectRow = Selectable<ProjectsTable>;
export type SkillRow = Selectable<SkillsTable>;
export type LanguageRow = Selectable<LanguagesTable>;
export type CertificationRow = Selectable<CertificationsTable>;

export interface CurationsTable {
  id: Generated<string>;
  account_id: string;
  source_ingestion_id: string;
  status: Generated<CurationStatus>;
  attempts: Generated<number>;
  max_attempts: number;
  prompt_version: string;
  model_id: string;
  failure_reason: CurationFailureReason | null;
  resume_after: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  started_at: Date | null;
  completed_at: Date | null;
}

export type CurationRow = Selectable<CurationsTable>;
export type NewCurationRow = Insertable<CurationsTable>;

export interface CurationUnitsTable {
  id: Generated<string>;
  curation_id: string;
  kind: CurationUnitKind;
  position: number;
  status: Generated<CurationUnitStatus>;
  attempts: Generated<number>;
  failure_reason: CurationUnitFailureReason | null;
  truncated: Generated<boolean>;
  subject_id: string | null;
  title: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type CurationUnitRow = Selectable<CurationUnitsTable>;
export type NewCurationUnitRow = Insertable<CurationUnitsTable>;

// pgvector reads and writes a vector as its text form, `[0.1,0.2,...]`.
export interface StatementsTable {
  id: Generated<string>;
  curation_id: string;
  unit_id: string;
  account_id: string;
  source_ingestion_id: string;
  text: string;
  labels: DefaultedJsonColumn;
  evidence: JsonColumn;
  prompt_version: string;
  model_id: string;
  review_state: Generated<StatementReviewState>;
  reviewed_at: Date | null;
  embedding: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type StatementRow = Selectable<StatementsTable>;
export type NewStatementRow = Insertable<StatementsTable>;

export interface DatabaseSchema {
  accounts: AccountsTable;
  sessions: SessionsTable;
  verification_tokens: VerificationTokensTable;
  ingestions: IngestionsTable;
  ingestion_segments: IngestionSegmentsTable;
  uploaded_resumes: UploadedResumesTable;
  basic_profiles: BasicProfilesTable;
  experiences: ExperiencesTable;
  education: EducationTable;
  projects: ProjectsTable;
  skills: SkillsTable;
  languages: LanguagesTable;
  certifications: CertificationsTable;
  curations: CurationsTable;
  curation_units: CurationUnitsTable;
  statements: StatementsTable;
}
