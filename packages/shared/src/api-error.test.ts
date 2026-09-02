import { describe, expect, it } from "vitest";

import { ApiErrorSchema } from "./api-error.js";

describe("ApiErrorSchema", () => {
  it("accepts the body NestJS produces for an HTTP exception", () => {
    const body = { statusCode: 409, message: "An Account with this email already exists", error: "Conflict" };

    expect(ApiErrorSchema.safeParse(body)).toEqual({ success: true, data: body });
  });

  it("accepts validation issues naming the field that failed", () => {
    const body = {
      statusCode: 400,
      message: "Validation failed",
      error: "Bad Request",
      issues: [{ path: "password", message: "Password must have at least 8 characters" }],
    };

    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ["a success status", { statusCode: 200, message: "ok" }],
    ["a missing message", { statusCode: 500 }],
  ])("rejects %s", (_label, input) => {
    expect(ApiErrorSchema.safeParse(input).success).toBe(false);
  });
});
