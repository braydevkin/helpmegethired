import type { CurationActionErrorCode, ModelChoiceErrorCode, ProfileRecognitionErrorCode, ResumeRefusalCode } from "@helpmegethired/shared";

import { ref, type JsonSchema } from "./components";

const JSON_TYPE = "application/json";

type ErrorCode = ResumeRefusalCode | ModelChoiceErrorCode | CurationActionErrorCode | ProfileRecognitionErrorCode;

export const json = (description: string, schema: JsonSchema, headers?: Record<string, JsonSchema>): JsonSchema => ({
  description,
  ...(headers ? { headers } : {}),
  content: { [JSON_TYPE]: { schema } },
});

// An error answer is the shared ApiError, narrowed to the codes that route can carry.
export const error = (description: string, codes: readonly ErrorCode[] = []): JsonSchema =>
  json(
    description,
    codes.length === 0 ? ref("ApiError") : { allOf: [ref("ApiError"), { type: "object", properties: { code: { type: "string", enum: codes } }, required: ["code"] }] },
  );

export const unauthorized = error("No valid Session bearer token");
export const notFound = error("The Account has no such record; another Account's id answers the same");
export const validationFailed = error("The body did not pass the shared schema; `issues` names each field");

export const body = (name: string): JsonSchema => ({ required: true, content: { [JSON_TYPE]: { schema: ref(name) } } });
