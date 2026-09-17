import {
  AccountInformationSchema,
  BasicProfileSchema,
  AccountModelChoiceSchema,
  AccountSchema,
  ApiErrorSchema,
  CuratedStatementSchema,
  CurationProgressStateSchema,
  CurationStatementsSchema,
  HealthStatusSchema,
  ModelChoiceRequestSchema,
  ModelChoiceStateSchema,
  ModelKeyTicketSchema,
  PROFILE_ENTRY_CORRECTION_SCHEMAS,
  ProfileRecognitionReceiptSchema,
  ProfileSchema,
  ResumeUploadReceiptSchema,
  ResumeUploadSchema,
  StatementReviewRequestSchema,
  UploadedResumeListSchema,
  UploadedResumeSchema,
} from "@helpmegethired/shared";
import { z, type ZodType } from "zod";

export type JsonSchema = Record<string, unknown>;

// Every schema is the shared Zod one turned into JSON Schema: request bodies as the input
// side (before the parse), answers as the output side, so nothing is described twice.
export const jsonSchemaOf = (schema: ZodType, io: "input" | "output"): JsonSchema =>
  Object.fromEntries(
    Object.entries(z.toJSONSchema(schema, { io, target: "draft-2020-12", unrepresentable: "any" })).filter(([key]) => key !== "$schema"),
  );

const COMPONENTS: Record<string, { schema: ZodType; io: "input" | "output" }> = {
  HealthStatus: { schema: HealthStatusSchema, io: "output" },
  Account: { schema: AccountSchema, io: "output" },
  AccountInformation: { schema: AccountInformationSchema, io: "input" },
  ApiError: { schema: ApiErrorSchema, io: "output" },
  ResumeUpload: { schema: ResumeUploadSchema, io: "input" },
  ResumeUploadReceipt: { schema: ResumeUploadReceiptSchema, io: "output" },
  UploadedResume: { schema: UploadedResumeSchema, io: "output" },
  UploadedResumeList: { schema: UploadedResumeListSchema, io: "output" },
  Profile: { schema: ProfileSchema, io: "output" },
  BasicProfile: { schema: BasicProfileSchema, io: "input" },
  ProfileEntryCorrection: { schema: z.union(Object.values(PROFILE_ENTRY_CORRECTION_SCHEMAS)), io: "input" },
  ProfileRecognitionReceipt: { schema: ProfileRecognitionReceiptSchema, io: "output" },
  ModelChoiceState: { schema: ModelChoiceStateSchema, io: "output" },
  ModelChoiceRequest: { schema: ModelChoiceRequestSchema, io: "input" },
  AccountModelChoice: { schema: AccountModelChoiceSchema, io: "output" },
  ModelKeyTicket: { schema: ModelKeyTicketSchema, io: "output" },
  CurationProgressState: { schema: CurationProgressStateSchema, io: "output" },
  CurationStatements: { schema: CurationStatementsSchema, io: "output" },
  CuratedStatement: { schema: CuratedStatementSchema, io: "output" },
  StatementReviewRequest: { schema: StatementReviewRequestSchema, io: "input" },
};

export const componentSchemas = (): Record<string, JsonSchema> =>
  Object.fromEntries(Object.entries(COMPONENTS).map(([name, { schema, io }]) => [name, jsonSchemaOf(schema, io)]));

export const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });
