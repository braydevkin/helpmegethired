import { ApiErrorSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { IngestionAlreadyActiveError } from "../ingestion/ingestion-errors";
import { apiErrorOf } from "./resume-error.filter";
import { UploadIncompleteError, UploadInFlightError, UploadedResumeNotFoundError } from "./resume-errors";

const id = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";

describe("apiErrorOf", () => {
  it.each([
    ["a missing record", new UploadedResumeNotFoundError(id), 404, undefined],
    ["a missing object", new UploadIncompleteError(id), 409, "upload_incomplete"],
    ["another upload in flight", new UploadInFlightError(id), 409, "ingestion_active"],
    ["an active Ingestion", new IngestionAlreadyActiveError(id), 409, "ingestion_active"],
  ])("maps %s to the status and code the page expects", (_label, error, statusCode, code) => {
    const body = apiErrorOf(error);

    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ statusCode, message: error.message });
    expect(body.code).toBe(code);
  });
});
