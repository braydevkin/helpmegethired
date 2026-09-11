import {
  AccountInformationSchema,
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
  ProfileSchema,
  ResumeUploadReceiptSchema,
  ResumeUploadSchema,
  StatementReviewRequestSchema,
  UploadedResumeListSchema,
  UploadedResumeSchema,
  UploadedResumeStatusSchema,
  type CurationActionErrorCode,
  type ModelChoiceErrorCode,
  type ResumeUploadErrorCode,
} from "@helpmegethired/shared";
import { z, type ZodType } from "zod";

export type JsonSchema = Record<string, unknown>;

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  security: Record<string, string[]>[];
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, JsonSchema>; securitySchemes: Record<string, JsonSchema> };
}

interface Operation {
  tags: string[];
  summary: string;
  description: string;
  operationId: string;
  security?: Record<string, string[]>[];
  parameters?: JsonSchema[];
  requestBody?: JsonSchema;
  responses: Record<string, JsonSchema>;
}

const SESSION = "session";
const MODEL_KEY_TICKET = "modelKeyTicket";
const JSON_TYPE = "application/json";

// Every schema is the shared Zod one turned into JSON Schema: request bodies as the input
// side (before the parse), answers as the output side, so nothing is described twice.
const jsonSchemaOf = (schema: ZodType, io: "input" | "output"): JsonSchema =>
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
  ModelChoiceState: { schema: ModelChoiceStateSchema, io: "output" },
  ModelChoiceRequest: { schema: ModelChoiceRequestSchema, io: "input" },
  AccountModelChoice: { schema: AccountModelChoiceSchema, io: "output" },
  ModelKeyTicket: { schema: ModelKeyTicketSchema, io: "output" },
  CurationProgressState: { schema: CurationProgressStateSchema, io: "output" },
  CurationStatements: { schema: CurationStatementsSchema, io: "output" },
  CuratedStatement: { schema: CuratedStatementSchema, io: "output" },
  StatementReviewRequest: { schema: StatementReviewRequestSchema, io: "input" },
};

const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });

const json = (description: string, schema: JsonSchema, headers?: Record<string, JsonSchema>): JsonSchema => ({
  description,
  ...(headers ? { headers } : {}),
  content: { [JSON_TYPE]: { schema } },
});

// An error answer is the shared ApiError, narrowed to the codes that route can carry.
const error = (description: string, codes: readonly (ResumeUploadErrorCode | ModelChoiceErrorCode | CurationActionErrorCode)[] = []): JsonSchema =>
  json(
    description,
    codes.length === 0 ? ref("ApiError") : { allOf: [ref("ApiError"), { type: "object", properties: { code: { type: "string", enum: codes } }, required: ["code"] }] },
  );

const unauthorized = error("No valid Session bearer token");
const notFound = error("The Account has no such record; another Account's id answers the same");
const validationFailed = error("The body did not pass the shared schema; `issues` names each field");

const body = (name: string): JsonSchema => ({ required: true, content: { [JSON_TYPE]: { schema: ref(name) } } });

const idParameterOf = (description: string): JsonSchema => ({
  name: "id",
  in: "path",
  required: true,
  description,
  schema: jsonSchemaOf(z.uuid(), "output"),
});

const idParameter = idParameterOf("The Uploaded Resume id");
const statementIdParameter = idParameterOf("The Statement id");

const ifNoneMatchParameter: JsonSchema = {
  name: "If-None-Match",
  in: "header",
  required: false,
  description: "The `ETag` of the last answer",
  schema: { type: "string" },
};

const notModified: JsonSchema = { description: "Nothing changed since the `If-None-Match` value" };

const paths: OpenApiDocument["paths"] = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Liveness of the API",
      description: "Answers without a Session. Compose and the deployment target use it as the health check.",
      operationId: "getHealth",
      security: [{}],
      responses: { "200": json("The API is up", ref("HealthStatus")) },
    },
  },
  "/auth/account": {
    get: {
      tags: ["Account"],
      summary: "The Account of the Session",
      description: "The Account Information of the signed-in Candidate: e-mail, name, phone, and address. Never a Profile field.",
      operationId: "getAccount",
      responses: { "200": json("The Account", ref("Account")), "401": unauthorized },
    },
    patch: {
      tags: ["Account"],
      summary: "Update the Account Information",
      description: "Name, last name, phone with its country code, and an optional address, validated with the shared schema.",
      operationId: "updateAccount",
      requestBody: body("AccountInformation"),
      responses: { "200": json("The updated Account", ref("Account")), "400": validationFailed, "401": unauthorized },
    },
  },
  "/auth/sign-out": {
    post: {
      tags: ["Account"],
      summary: "End the Session",
      description: "Deletes the Session the bearer token names. The web app clears its cookie afterwards.",
      operationId: "signOut",
      responses: { "204": { description: "The Session is gone" }, "401": unauthorized },
    },
  },
  "/account/model": {
    get: {
      tags: ["Model Choice"],
      summary: "The Account's Model Choice",
      description:
        "The Provider, the Model, and whether a Model Key is stored; never the key or any part of it. An Account that has not chosen yet answers `choice: null`.",
      operationId: "getModelChoice",
      responses: { "200": json("The Model Choice, or none yet", ref("ModelChoiceState")), "401": unauthorized },
    },
    put: {
      tags: ["Model Choice"],
      summary: "Choose the Model and store the Model Key",
      description:
        "Checks the key with the Provider without spending tokens, then stores it encrypted, replacing any earlier choice and key. Only the catalogue pairing is accepted. A refused key replaces nothing, and the key is never answered back. The page sends it with a Model Key ticket instead of the Session, so the key never passes through the web app; the ticket is spent before the key is checked, so a refused key needs a new one.",
      operationId: "saveModelChoice",
      security: [{ [SESSION]: [] }, { [MODEL_KEY_TICKET]: [] }],
      requestBody: body("ModelChoiceRequest"),
      responses: {
        "200": json("The stored choice", ref("AccountModelChoice")),
        "400": error("The body did not pass the shared schema; `unsupported_model_choice` when the Provider or the Model is not in the catalogue"),
        "401": error("Neither a live Session nor a valid Model Key ticket; `model_key_ticket_invalid` whether the ticket is unknown, expired, or used", [
          "model_key_ticket_invalid",
        ]),
        "422": error("`model_key_invalid` when the Provider does not accept the key; `model_key_not_permitted` when it does but not for the chosen Model", [
          "model_key_invalid",
          "model_key_not_permitted",
        ]),
        "503": error("`provider_unavailable` when the Provider could not be reached to check the key", ["provider_unavailable"]),
      },
    },
  },
  "/account/model/key-ticket": {
    post: {
      tags: ["Model Choice"],
      summary: "Issue a Model Key ticket",
      description:
        "A single-use ticket for the Session's Account, valid for 60 seconds. The web app hands it to the page, which presents it as the bearer token of `PUT /account/model` to send the Model Key straight to the API. It is kept only as its SHA-256, and no other route accepts it.",
      operationId: "issueModelKeyTicket",
      responses: { "201": json("The ticket and when it expires", ref("ModelKeyTicket")), "401": unauthorized },
    },
  },
  "/account/model/key": {
    delete: {
      tags: ["Model Choice"],
      summary: "Revoke the Model Key",
      description: "Deletes the stored key. The Model Choice stays, and no new analysis starts until another key is stored.",
      operationId: "revokeModelKey",
      responses: {
        "200": json("The choice, with no key stored", ref("AccountModelChoice")),
        "401": unauthorized,
        "404": error("The Account has not chosen a Model yet"),
      },
    },
  },
  "/resumes": {
    post: {
      tags: ["Resumes"],
      summary: "Reserve an Uploaded Resume and get the presigned upload",
      description:
        "Declares the file name, size, and SHA-256. Answers a pending record and a presigned PUT the browser sends the bytes to. The same bytes already uploaded answer the existing record with no upload to perform.",
      operationId: "requestUpload",
      requestBody: body("ResumeUpload"),
      responses: {
        "201": json("A new record with its presigned upload", ref("ResumeUploadReceipt")),
        "200": json("The existing record for the same bytes; `upload` is null once the file arrived, or a fresh URL while the record is still pending", ref("ResumeUploadReceipt")),
        "400": validationFailed,
        "401": unauthorized,
      },
    },
    get: {
      tags: ["Resumes"],
      summary: "List the Account's Uploaded Resumes",
      description: "Newest first, with the Ingestion Progress of each record that has one.",
      operationId: "listResumes",
      parameters: [
        {
          name: "status",
          in: "query",
          required: false,
          description: "Only the records in this status",
          schema: jsonSchemaOf(UploadedResumeStatusSchema, "output"),
        },
      ],
      responses: {
        "200": json("The records", ref("UploadedResumeList")),
        "400": error("The status is not one of the known ones"),
        "401": unauthorized,
      },
    },
  },
  "/resumes/{id}/complete": {
    post: {
      tags: ["Resumes"],
      summary: "Tell the API the bytes are in storage",
      description:
        "Heads the object up to three times, 500 ms apart, marks the record uploaded, and adds the extraction job. Idempotent for a record no longer pending.",
      operationId: "completeUpload",
      parameters: [idParameter],
      responses: {
        "202": json("The record, uploaded and queued for extraction", ref("UploadedResume")),
        "401": unauthorized,
        "404": notFound,
        "409": error(
          "`upload_incomplete` when the object is missing or has another size (the record stays pending); `ingestion_active` while another upload or Ingestion of the Account is in flight",
          ["upload_incomplete", "ingestion_active"],
        ),
      },
    },
  },
  "/resumes/{id}": {
    get: {
      tags: ["Resumes"],
      summary: "One Uploaded Resume with its status and Progress",
      description:
        "The record with its status, its error code when failed, and the Ingestion Progress while the Profile is being built. The `ETag` changes with them; send it back as `If-None-Match` to poll cheaply.",
      operationId: "getResume",
      parameters: [idParameter, ifNoneMatchParameter],
      responses: {
        "200": json("The record", ref("UploadedResume"), {
          ETag: { description: "Changes with the status, the error code, and the Progress", schema: { type: "string" } },
        }),
        "304": notModified,
        "401": unauthorized,
        "404": notFound,
      },
    },
  },
  "/profile": {
    get: {
      tags: ["Profile"],
      summary: "The Profile built from the latest completed Ingestion",
      description:
        "The seven parts, the years of experience derived from the Experiences with overlaps counted once, the review flags for the fields recognised with low Confidence, and the source Uploaded Resume. An Account with no completed Ingestion gets an empty Profile with no source.",
      operationId: "getProfile",
      responses: { "200": json("The Profile", ref("Profile")), "401": unauthorized },
    },
  },
  "/profile/confirm": {
    post: {
      tags: ["Profile"],
      summary: "Confirm the Profile",
      description: "Records the confirmation time once and clears the review flags until the next Ingestion replaces the rows. Idempotent.",
      operationId: "confirmProfile",
      responses: {
        "200": json("The confirmed Profile", ref("Profile")),
        "401": unauthorized,
        "404": error("No Profile has been built for the Account yet"),
      },
    },
  },
  "/profile/curation": {
    get: {
      tags: ["Curation"],
      summary: "The progress of the current Curation",
      description:
        "The newest Curation of the Profile on screen: its status, the percentage of units saved, every unit with its kind, title, and status, the metrics counted from the Profile, the Model it runs on, and the failure reason with `resumeAfter` when it waits out a rate limit. The percentage counts saved units only, so every process answers the same number. An Account with no Curation for its latest Profile answers `progress: null`. Statements are not part of this answer. The `ETag` changes with any of it; send it back as `If-None-Match` to poll cheaply.",
      operationId: "getCurationProgress",
      parameters: [ifNoneMatchParameter],
      responses: {
        "200": json("The progress, or none yet", ref("CurationProgressState"), {
          ETag: { description: "Changes with anything in the answer", schema: { type: "string" } },
        }),
        "304": notModified,
        "401": unauthorized,
      },
    },
  },
  "/profile/curation/statements": {
    get: {
      tags: ["Curation"],
      summary: "The Statements of the current Curation",
      description:
        "Every Statement of the latest completed Curation, the one retrieval reads, in the order of its units: the sentence, its labels, its Evidence, the unit it came from, and its review. An Account with no completed Curation answers `curationId: null` with no Statements. A rejected Statement is listed here and never retrieved. A review is not carried to the Statements of a re-run.",
      operationId: "listCurationStatements",
      responses: { "200": json("The Statements, or none yet", ref("CurationStatements")), "401": unauthorized },
    },
  },
  "/profile/curation/statements/{id}/review": {
    put: {
      tags: ["Curation"],
      summary: "Review a Statement",
      description:
        "Sets the review to `accepted` or `rejected`, recording when, or clears it back to `unreviewed`. A rejected Statement keeps its row and is left out of every retrieval; accepted and unreviewed Statements are both retrieved.",
      operationId: "reviewStatement",
      parameters: [statementIdParameter],
      requestBody: body("StatementReviewRequest"),
      responses: {
        "200": json("The reviewed Statement", ref("CuratedStatement")),
        "400": validationFailed,
        "401": unauthorized,
        "404": notFound,
      },
    },
  },
  "/profile/curation/cancel": {
    post: {
      tags: ["Curation"],
      summary: "Stop the Curation",
      description:
        "Moves the queued or running Curation to `cancelled`. The runner stops at its next unit boundary, the Statements already saved are kept for a retry, and nothing is indexed. Answers the progress as it now stands.",
      operationId: "cancelCuration",
      responses: {
        "200": json("The progress, now cancelled", ref("CurationProgressState")),
        "401": unauthorized,
        "404": error("`curation_not_found` when no Curation is queued or running", ["curation_not_found"]),
      },
    },
  },
  "/profile/curation/retry": {
    post: {
      tags: ["Curation"],
      summary: "Try the failed or cancelled Curation again",
      description:
        "Takes the newest Curation of the Profile, when it is `failed` or `cancelled`, back to `queued` with its attempts reset and its reason cleared, and adds its job again. Saved units stay saved, so the runner resumes at the first unsaved one and the Candidate pays only for what is left.",
      operationId: "retryCuration",
      responses: {
        "202": json("The progress, queued again", ref("CurationProgressState")),
        "401": unauthorized,
        "404": error("`curation_not_found` when the Profile has no Curation", ["curation_not_found"]),
        "409": error("`curation_active` while a Curation is queued or running", ["curation_active"]),
        "422": error(
          "`curation_not_ready` before the Profile is confirmed and a Model Key stored; `curation_not_retryable` when the Curation is not failed or cancelled; `curation_model_changed` when the Model Choice changed since it started, which a re-run answers instead",
          ["curation_not_ready", "curation_not_retryable", "curation_model_changed"],
        ),
      },
    },
  },
  "/profile/curation/rerun": {
    post: {
      tags: ["Curation"],
      summary: "Run the Curation again from zero",
      description:
        "Creates a new Curation beside the current completed one, which stays current and retrievable until the new one completes and supersedes it; a re-run that fails or is cancelled leaves it intact. It spends the Candidate's tokens, so it is allowed only when the newest Curation of the Profile failed or was cancelled, or the Profile, the Model, or the prompt version changed since the current one was produced.",
      operationId: "rerunCuration",
      responses: {
        "202": json("The progress of the new Curation", ref("CurationProgressState")),
        "401": unauthorized,
        "409": error("`curation_active` while a Curation is queued or running", ["curation_active"]),
        "422": error("`curation_not_ready` before the Profile is confirmed and a Model Key stored; `curation_unchanged` when running it again would produce the same Statements", [
          "curation_not_ready",
          "curation_unchanged",
        ]),
      },
    },
  },
};

export const openApiDocument = (): OpenApiDocument => ({
  openapi: "3.1.0",
  info: {
    title: "Help Me Get Hired API",
    version: "0.0.0",
    description:
      "The routes the web app calls on behalf of a Candidate. Every schema is generated from `packages/shared`, so the document and the code cannot disagree. Every route except `/health` needs the Session bearer token Auth.js issues in the web app; paste the value of its `session` cookie.",
  },
  servers: [{ url: "/", description: "The API that serves this document; on the Docker Compose stack, http://localhost:API_PORT" }],
  tags: [
    { name: "Health", description: "Liveness" },
    { name: "Account", description: "The signed-in Candidate's Account Information and Session" },
    { name: "Model Choice", description: "The Provider and Model an Account analyses with, and its Model Key" },
    { name: "Resumes", description: "Uploaded Resumes: the presigned upload, its completion, and the record's status" },
    { name: "Profile", description: "The Profile the Ingestion built and its confirmation" },
    { name: "Curation", description: "Profile Curation: the Statements built from the confirmed Profile, and their progress" },
  ],
  security: [{ [SESSION]: [] }],
  paths,
  components: {
    schemas: Object.fromEntries(Object.entries(COMPONENTS).map(([name, { schema, io }]) => [name, jsonSchemaOf(schema, io)])),
    securitySchemes: {
      [SESSION]: {
        type: "http",
        scheme: "bearer",
        description: "The Session token the web app keeps in its `session` cookie after sign in",
      },
      [MODEL_KEY_TICKET]: {
        type: "http",
        scheme: "bearer",
        description: "A single-use Model Key ticket from `POST /account/model/key-ticket`; only `PUT /account/model` accepts it",
      },
    },
  },
});
