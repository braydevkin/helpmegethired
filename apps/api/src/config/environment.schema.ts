import { z } from "zod";

const portRange = { error: "must be between 1 and 65535" };

const requiredOr = (invalid: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? "is required" : invalid;

const requiredText = () => z.string({ error: requiredOr("must be text") }).min(1, { error: "must not be empty" });

export const DatabaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: requiredOr("must be a PostgreSQL connection URL"),
  }),
});

export type DatabaseEnvironment = z.infer<typeof DatabaseEnvironmentSchema>;

export const QueueEnvironmentSchema = z.object({
  REDIS_URL: z.url({
    protocol: /^rediss?$/,
    error: requiredOr("must be a Redis connection URL"),
  }),
  WORKER_CONCURRENCY: z.coerce
    .number({ error: "must be a number" })
    .int({ error: "must be a whole number" })
    .min(1, { error: "must be at least 1" })
    .default(4),
});

export type QueueEnvironment = z.infer<typeof QueueEnvironmentSchema>;

export const StorageEnvironmentSchema = z.object({
  S3_ENDPOINT: z.url({ protocol: /^https?$/, error: requiredOr("must be an absolute HTTP URL") }),
  S3_PUBLIC_ENDPOINT: z.url({ protocol: /^https?$/, error: requiredOr("must be an absolute HTTP URL") }),
  S3_BUCKET: requiredText(),
  S3_ACCESS_KEY: requiredText(),
  S3_SECRET_KEY: requiredText(),
  S3_REGION: requiredText().default("us-east-1"),
  PRESIGN_EXPIRES_SECONDS: z.coerce
    .number({ error: "must be a number" })
    .int({ error: "must be a whole number" })
    .positive({ error: "must be above zero" })
    .default(300),
});

export type StorageEnvironment = z.infer<typeof StorageEnvironmentSchema>;

export const EnvironmentSchema = DatabaseEnvironmentSchema.extend(QueueEnvironmentSchema.shape)
  .extend(StorageEnvironmentSchema.shape)
  .extend({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce
      .number({ error: "must be a number" })
      .int({ error: "must be a whole number" })
      .min(1, portRange)
      .max(65535, portRange)
      .default(3001),
    WEB_ORIGIN: z.url({ error: requiredOr("must be an absolute URL") }),
  });

export type Environment = z.infer<typeof EnvironmentSchema>;
