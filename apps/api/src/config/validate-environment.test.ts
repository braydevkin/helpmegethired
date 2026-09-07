import { describe, expect, it } from "vitest";

import {
  EnvironmentValidationError,
  validateDatabaseEnvironment,
  validateEnvironment,
  validateQueueEnvironment,
  validateStorageEnvironment,
} from "./validate-environment";

const storage = {
  S3_ENDPOINT: "http://storage:9000",
  S3_PUBLIC_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "resumes",
  S3_ACCESS_KEY: "storage-access-key",
  S3_SECRET_KEY: "storage-secret-key",
};

const complete = {
  NODE_ENV: "production",
  PORT: "8080",
  WEB_ORIGIN: "https://helpmegethired.example",
  DATABASE_URL: "postgresql://candidate:secret@postgres:5432/helpmegethired",
  REDIS_URL: "redis://redis:6379",
  WORKER_CONCURRENCY: "8",
  ...storage,
  S3_REGION: "eu-west-1",
  PRESIGN_EXPIRES_SECONDS: "120",
};

const required = {
  WEB_ORIGIN: complete.WEB_ORIGIN,
  DATABASE_URL: complete.DATABASE_URL,
  REDIS_URL: complete.REDIS_URL,
  ...storage,
};

describe("validateEnvironment", () => {
  it("parses every variable into its typed value", () => {
    expect(validateEnvironment(complete)).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
      WEB_ORIGIN: "https://helpmegethired.example",
      DATABASE_URL: complete.DATABASE_URL,
      REDIS_URL: complete.REDIS_URL,
      WORKER_CONCURRENCY: 8,
      ...storage,
      S3_REGION: "eu-west-1",
      PRESIGN_EXPIRES_SECONDS: 120,
    });
  });

  it("applies defaults for the optional variables", () => {
    expect(validateEnvironment(required)).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      WORKER_CONCURRENCY: 4,
      S3_REGION: "us-east-1",
      PRESIGN_EXPIRES_SECONDS: 300,
      ...required,
    });
  });

  it("drops variables the API does not declare", () => {
    const parsed = validateEnvironment({ ...complete, HOME: "/home/candidate" });

    expect(parsed).not.toHaveProperty("HOME");
  });

  it.each([
    ["a missing WEB_ORIGIN", { ...complete, WEB_ORIGIN: undefined }, "WEB_ORIGIN is required"],
    ["a relative WEB_ORIGIN", { ...complete, WEB_ORIGIN: "/app" }, "WEB_ORIGIN must be an absolute URL"],
    ["a missing DATABASE_URL", { ...complete, DATABASE_URL: undefined }, "DATABASE_URL is required"],
    [
      "a DATABASE_URL for another database",
      { ...complete, DATABASE_URL: "mysql://candidate:secret@mysql:3306/helpmegethired" },
      "DATABASE_URL must be a PostgreSQL connection URL",
    ],
    ["a non-numeric PORT", { ...complete, PORT: "http" }, "PORT must be a number"],
    ["a fractional PORT", { ...complete, PORT: "80.5" }, "PORT must be a whole number"],
    ["a PORT above 65535", { ...complete, PORT: "70000" }, "PORT must be between 1 and 65535"],
    ["a missing REDIS_URL", { ...complete, REDIS_URL: undefined }, "REDIS_URL is required"],
    [
      "a REDIS_URL for another store",
      { ...complete, REDIS_URL: "amqp://rabbit:5672" },
      "REDIS_URL must be a Redis connection URL",
    ],
    ["a non-numeric WORKER_CONCURRENCY", { ...complete, WORKER_CONCURRENCY: "many" }, "WORKER_CONCURRENCY must be a number"],
    ["a WORKER_CONCURRENCY of zero", { ...complete, WORKER_CONCURRENCY: "0" }, "WORKER_CONCURRENCY must be at least 1"],
    ["an unknown NODE_ENV", { ...complete, NODE_ENV: "staging" }, "NODE_ENV Invalid option"],
    ["a missing S3_ENDPOINT", { ...complete, S3_ENDPOINT: undefined }, "S3_ENDPOINT is required"],
    ["a relative S3_PUBLIC_ENDPOINT", { ...complete, S3_PUBLIC_ENDPOINT: "storage:9000" }, "S3_PUBLIC_ENDPOINT must be an absolute HTTP URL"],
    ["an S3_ENDPOINT on another scheme", { ...complete, S3_ENDPOINT: "s3://resumes" }, "S3_ENDPOINT must be an absolute HTTP URL"],
    ["an empty S3_BUCKET", { ...complete, S3_BUCKET: "" }, "S3_BUCKET must not be empty"],
    ["a missing S3_ACCESS_KEY", { ...complete, S3_ACCESS_KEY: undefined }, "S3_ACCESS_KEY is required"],
    ["a missing S3_SECRET_KEY", { ...complete, S3_SECRET_KEY: undefined }, "S3_SECRET_KEY is required"],
    ["a non-numeric PRESIGN_EXPIRES_SECONDS", { ...complete, PRESIGN_EXPIRES_SECONDS: "soon" }, "PRESIGN_EXPIRES_SECONDS must be a number"],
    ["a fractional PRESIGN_EXPIRES_SECONDS", { ...complete, PRESIGN_EXPIRES_SECONDS: "1.5" }, "PRESIGN_EXPIRES_SECONDS must be a whole number"],
    ["a zero PRESIGN_EXPIRES_SECONDS", { ...complete, PRESIGN_EXPIRES_SECONDS: "0" }, "PRESIGN_EXPIRES_SECONDS must be above zero"],
  ])("fails on %s naming the variable", (_label, input, expectedProblem) => {
    expect(() => validateEnvironment(input)).toThrow(EnvironmentValidationError);
    expect(() => validateEnvironment(input)).toThrow(expectedProblem);
  });

  it("lists every problem in one message", () => {
    const message = () => validateEnvironment({ PORT: "0" });

    expect(message).toThrow("Invalid environment configuration:");
    expect(message).toThrow("PORT must be between 1 and 65535");
    expect(message).toThrow("WEB_ORIGIN is required");
    expect(message).toThrow("DATABASE_URL is required");
    expect(message).toThrow("REDIS_URL is required");
    expect(message).toThrow("S3_ENDPOINT is required");
  });
});

describe("validateDatabaseEnvironment", () => {
  it("accepts the postgres and postgresql schemes", () => {
    const short = "postgres://candidate:secret@localhost:5432/helpmegethired";

    expect(validateDatabaseEnvironment({ DATABASE_URL: short })).toEqual({ DATABASE_URL: short });
    expect(validateDatabaseEnvironment(complete)).toEqual({ DATABASE_URL: complete.DATABASE_URL });
  });

  it("needs only the database variable", () => {
    expect(() => validateDatabaseEnvironment({})).toThrow("DATABASE_URL is required");
    expect(() => validateDatabaseEnvironment({})).not.toThrow("WEB_ORIGIN");
  });
});

describe("validateStorageEnvironment", () => {
  it("needs only the storage variables and applies their defaults", () => {
    expect(validateStorageEnvironment(storage)).toEqual({
      ...storage,
      S3_REGION: "us-east-1",
      PRESIGN_EXPIRES_SECONDS: 300,
    });
    expect(() => validateStorageEnvironment({})).toThrow("S3_BUCKET is required");
    expect(() => validateStorageEnvironment({})).not.toThrow("DATABASE_URL");
  });
});

describe("validateQueueEnvironment", () => {
  it("accepts the redis and rediss schemes", () => {
    const secure = "rediss://queue.example:6380";

    expect(validateQueueEnvironment({ REDIS_URL: secure })).toEqual({ REDIS_URL: secure, WORKER_CONCURRENCY: 4 });
    expect(validateQueueEnvironment(complete)).toMatchObject({ REDIS_URL: complete.REDIS_URL });
  });

  it("needs only the queue variables", () => {
    expect(() => validateQueueEnvironment({})).toThrow("REDIS_URL is required");
    expect(() => validateQueueEnvironment({})).not.toThrow("DATABASE_URL");
  });
});
