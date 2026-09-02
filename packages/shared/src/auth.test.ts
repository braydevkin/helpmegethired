import { describe, expect, it } from "vitest";

import { AuthenticatedAccountSchema, CredentialsSchema } from "./auth.js";
import { account } from "./candidate.fixtures.js";

const credentials = { email: "ada@example.com", password: "correct horse battery" };

describe("CredentialsSchema", () => {
  it("accepts an email and a password of at least eight characters", () => {
    expect(CredentialsSchema.safeParse(credentials)).toEqual({ success: true, data: credentials });
  });

  it("normalises the email by trimming and lowercasing it", () => {
    const parsed = CredentialsSchema.parse({ ...credentials, email: "  Ada@Example.COM " });

    expect(parsed.email).toBe("ada@example.com");
  });

  it.each([
    ["a malformed email", { ...credentials, email: "ada-at-example.com" }, "Enter a valid email address"],
    ["a missing email", { password: credentials.password }, "Email is required"],
    ["a short password", { ...credentials, password: "1234567" }, "at least 8 characters"],
    ["an overlong password", { ...credentials, password: "x".repeat(129) }, "at most 128 characters"],
    ["a missing password", { email: credentials.email }, "Password is required"],
  ])("rejects %s with a readable message", (_label, input, message) => {
    const result = CredentialsSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join("\n")).toContain(message);
  });
});

describe("AuthenticatedAccountSchema", () => {
  const session = { token: "opaque-token", expiresAt: "2026-10-02T10:00:00.000Z" };

  it("pairs an Account with its Session", () => {
    expect(AuthenticatedAccountSchema.safeParse({ account, session }).success).toBe(true);
  });

  it.each([
    ["an empty token", { account, session: { ...session, token: "" } }],
    ["an expiry without time", { account, session: { ...session, expiresAt: "2026-10-02" } }],
    ["a missing account", { session }],
  ])("rejects %s", (_label, input) => {
    expect(AuthenticatedAccountSchema.safeParse(input).success).toBe(false);
  });
});
