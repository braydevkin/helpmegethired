import { describe, expect, it } from "vitest";

import { AuthEnvironmentError, readAuthEnvironment } from "./auth-environment";

const valid = {
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://helpmegethired:helpmegethired@localhost:5432/helpmegethired",
};

const withResend = { ...valid, AUTH_RESEND_KEY: "re_test_key", EMAIL_FROM: "no-reply@example.com" };

describe("readAuthEnvironment", () => {
  it("accepts the secret and the database URL and defaults NODE_ENV to development", () => {
    expect(readAuthEnvironment(valid)).toEqual({ ...valid, NODE_ENV: "development" });
  });

  it("ignores unrelated variables", () => {
    expect(readAuthEnvironment({ ...valid, PATH: "/usr/bin" })).not.toHaveProperty("PATH");
  });

  it("accepts the Resend key with a sender address", () => {
    expect(readAuthEnvironment(withResend)).toMatchObject(withResend);
  });

  it.each([
    "Help Me Get Hired <no-reply@example.com>",
    "no-reply@mail.example.com",
  ])("accepts %s as the sender", (EMAIL_FROM) => {
    expect(readAuthEnvironment({ ...withResend, EMAIL_FROM }).EMAIL_FROM).toBe(EMAIL_FROM);
  });

  it("treats a blank Resend key and sender as unset, as the compose file passes them", () => {
    const environment = readAuthEnvironment({ ...valid, AUTH_RESEND_KEY: "", EMAIL_FROM: "" });

    expect(environment.AUTH_RESEND_KEY).toBeUndefined();
    expect(environment.EMAIL_FROM).toBeUndefined();
  });

  it.each([
    ["a missing secret", { DATABASE_URL: valid.DATABASE_URL }, "AUTH_SECRET is required"],
    ["a short secret", { ...valid, AUTH_SECRET: "short" }, "AUTH_SECRET must have at least 32 characters"],
    ["a missing database URL", { AUTH_SECRET: valid.AUTH_SECRET }, "DATABASE_URL is required"],
    ["a non-PostgreSQL URL", { ...valid, DATABASE_URL: "mysql://localhost/db" }, "DATABASE_URL must be a PostgreSQL"],
    ["an unknown NODE_ENV", { ...valid, NODE_ENV: "staging" }, "NODE_ENV"],
    [
      "a Resend key without a sender",
      { ...valid, AUTH_RESEND_KEY: "re_test_key" },
      "EMAIL_FROM is required when AUTH_RESEND_KEY is set",
    ],
    ["a sender that is not an address", { ...withResend, EMAIL_FROM: "Help Me Get Hired" }, "EMAIL_FROM must be an email address"],
    ["a sender with an unclosed name", { ...withResend, EMAIL_FROM: "Hired <no-reply@example.com" }, "EMAIL_FROM must be"],
  ])("names the problem for %s", (_label, variables, message) => {
    expect(() => readAuthEnvironment(variables)).toThrow(AuthEnvironmentError);
    expect(() => readAuthEnvironment(variables)).toThrow(message);
  });
});
