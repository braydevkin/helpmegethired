import { describe, expect, it } from "vitest";

import { AuthEnvironmentError, readAuthEnvironment } from "./auth-environment";

const valid = {
  AUTH_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://helpmegethired:helpmegethired@localhost:5432/helpmegethired",
};

describe("readAuthEnvironment", () => {
  it("accepts the secret and the database URL and defaults NODE_ENV to development", () => {
    expect(readAuthEnvironment(valid)).toEqual({ ...valid, NODE_ENV: "development" });
  });

  it("ignores unrelated variables", () => {
    expect(readAuthEnvironment({ ...valid, PATH: "/usr/bin" })).not.toHaveProperty("PATH");
  });

  it.each([
    ["a missing secret", { DATABASE_URL: valid.DATABASE_URL }, "AUTH_SECRET is required"],
    ["a short secret", { ...valid, AUTH_SECRET: "short" }, "AUTH_SECRET must have at least 32 characters"],
    ["a missing database URL", { AUTH_SECRET: valid.AUTH_SECRET }, "DATABASE_URL is required"],
    ["a non-PostgreSQL URL", { ...valid, DATABASE_URL: "mysql://localhost/db" }, "DATABASE_URL must be a PostgreSQL"],
    ["an unknown NODE_ENV", { ...valid, NODE_ENV: "staging" }, "NODE_ENV"],
  ])("names the problem for %s", (_label, variables, message) => {
    expect(() => readAuthEnvironment(variables)).toThrow(AuthEnvironmentError);
    expect(() => readAuthEnvironment(variables)).toThrow(message);
  });
});
