import {
  AccountInformationSchema,
  AccountSchema,
  ApiErrorSchema,
  HealthStatusSchema,
  ProfileSchema,
  ResumeUploadReceiptSchema,
  ResumeUploadSchema,
  UploadedResumeListSchema,
  UploadedResumeSchema,
  UploadedResumeStatusSchema,
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
};

const ref = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });

const json = (description: string, schema: JsonSchema, headers?: Record<string, JsonSchema>): JsonSchema => ({
  description,
  ...(headers ? { headers } : {}),
  content: { [JSON_TYPE]: { schema } },
});

// An error answer is the shared ApiError, narrowed to the codes that route can carry.
const error = (description: string, codes: readonly ResumeUploadErrorCode[] = []): JsonSchema =>
  json(
    description,
    codes.length === 0 ? ref("ApiError") : { allOf: [ref("ApiError"), { type: "object", properties: { code: { type: "string", enum: codes } }, required: ["code"] }] },
  );

const unauthorized = error("No valid Session bearer token");
const notFound = error("The Account has no such record; another Account's id answers the same");
const validationFailed = error("The body did not pass the shared schema; `issues` names each field");

const body = (name: string): JsonSchema => ({ required: true, content: { [JSON_TYPE]: { schema: ref(name) } } });

const idParameter: JsonSchema = {
  name: "id",
  in: "path",
  required: true,
  description: "The Uploaded Resume id",
  schema: jsonSchemaOf(z.uuid(), "output"),
};

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
      parameters: [
        idParameter,
        {
          name: "If-None-Match",
          in: "header",
          required: false,
          description: "The `ETag` of the last answer",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": json("The record", ref("UploadedResume"), {
          ETag: { description: "Changes with the status, the error code, and the Progress", schema: { type: "string" } },
        }),
        "304": { description: "Nothing changed since the `If-None-Match` value" },
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
    { name: "Resumes", description: "Uploaded Resumes: the presigned upload, its completion, and the record's status" },
    { name: "Profile", description: "The Profile the Ingestion built and its confirmation" },
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
    },
  },
});
