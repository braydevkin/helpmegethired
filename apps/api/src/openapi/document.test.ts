import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { openApiDocument, type JsonSchema } from "./document";
import { OPENAPI_FILE, renderedDocument } from "./generate";

const document = openApiDocument();
const operations = Object.entries(document.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method, operation })));

const refsIn = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(refsIn);
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, nested]) => (key === "$ref" && typeof nested === "string" ? [nested] : refsIn(nested)));
  }

  return [];
};

const responseSchemaOf = (response: JsonSchema): unknown => (response.content as Record<string, { schema: unknown }> | undefined)?.["application/json"]?.schema;

describe("the OpenAPI document", () => {
  it("describes every resume, Profile, Account, and health route", () => {
    expect(operations.map(({ method, path }) => `${method.toUpperCase()} ${path}`).sort()).toEqual(
      [
        "GET /health",
        "GET /auth/account",
        "PATCH /auth/account",
        "POST /auth/sign-out",
        "POST /resumes",
        "GET /resumes",
        "POST /resumes/{id}/complete",
        "GET /resumes/{id}",
        "GET /profile",
        "POST /profile/confirm",
      ].sort(),
    );
  });

  it("resolves every reference to a component generated from the shared schemas", () => {
    const names = Object.keys(document.components.schemas);

    for (const reference of refsIn(document.paths)) {
      expect(names.map((name) => `#/components/schemas/${name}`)).toContain(reference);
    }

    expect(names).toEqual(expect.arrayContaining(["Account", "ApiError", "ResumeUpload", "ResumeUploadReceipt", "UploadedResume", "Profile"]));
    expect(document.components.schemas.Profile).toMatchObject({ type: "object", required: expect.arrayContaining(["accountId", "reviewFlags", "source"]) });
  });

  it("gives every operation an id, a summary, and at least one answer, and every error answer the shared ApiError", () => {
    for (const { operation } of operations) {
      expect(operation.operationId).toMatch(/^[a-z][A-Za-z]+$/);
      expect(operation.summary.length).toBeGreaterThan(0);
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);

      for (const [status, response] of Object.entries(operation.responses)) {
        if (Number(status) >= 400) {
          expect(refsIn(responseSchemaOf(response))).toContain("#/components/schemas/ApiError");
        }
      }
    }
  });

  it("names the codes an error answer can carry", () => {
    const conflict = document.paths["/resumes/{id}/complete"]?.post?.responses["409"];

    expect(JSON.stringify(responseSchemaOf(conflict ?? {}))).toContain('"enum":["upload_incomplete","ingestion_active"]');
  });

  it("requires the Session on every route but health, which declares security optional", () => {
    expect(document.security).toEqual([{ session: [] }]);
    expect(document.components.securitySchemes.session).toMatchObject({ type: "http", scheme: "bearer" });

    for (const { path, operation } of operations) {
      expect(operation.security ?? document.security).toEqual(path === "/health" ? [{}] : [{ session: [] }]);
    }
  });

  it("bounds every list it describes", () => {
    const unbounded = (value: unknown, at: string): string[] => {
      if (Array.isArray(value)) {
        return value.flatMap((item, index) => unbounded(item, `${at}[${index}]`));
      }

      if (typeof value !== "object" || value === null) {
        return [];
      }

      const record = value as Record<string, unknown>;
      const here = record.type === "array" && record.maxItems === undefined ? [at] : [];

      return [...here, ...Object.entries(record).flatMap(([key, nested]) => unbounded(nested, `${at}.${key}`))];
    };

    expect(unbounded(document.components.schemas, "components.schemas")).toEqual([]);
  });

  it("is what the committed openapi.json holds", () => {
    expect(readFileSync(OPENAPI_FILE, "utf8")).toBe(renderedDocument());
  });
});
