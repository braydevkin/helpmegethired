import { z } from "zod";

import { DEVELOPMENT_MODEL_KEY_ENCRYPTION_KEY, MODEL_KEY_ENCRYPTION_KEY_BYTES, decodeEncryptionKey } from "./model-key-encryption-key";

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
  EXTRACTION_TIMEOUT_MS: z.coerce
    .number({ error: "must be a number" })
    .int({ error: "must be a whole number" })
    .positive({ error: "must be above zero" })
    .default(30_000),
  STALE_PROCESSING_MINUTES: z.coerce
    .number({ error: "must be a number" })
    .int({ error: "must be a whole number" })
    .min(1, { error: "must be at least 1" })
    .default(10),
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

const blankAsUnset = (value: unknown): unknown => (value === "" ? undefined : value);

// Unset and blank both become null, never undefined: ConfigService answers an undefined
// validated value from process.env, where compose's blank would come back as "".
const settingOf = <Schema extends z.ZodType<string>>(schema: Schema) =>
  z.preprocess(blankAsUnset, schema.optional()).transform((value) => value ?? null);

const isEncryptionKey = (value: string): boolean =>
  /^[A-Za-z0-9+/]+={0,2}$/.test(value) && decodeEncryptionKey(value).length === MODEL_KEY_ENCRYPTION_KEY_BYTES;

export const ModelEnvironmentSchema = z.object({
  MODEL_ADAPTER: settingOf(z.enum(["anthropic"], { error: "must be anthropic, or blank for the development stand-in" })),
  MODEL_KEY_ENCRYPTION_KEY: settingOf(z.string().refine(isEncryptionKey, { error: `must be ${MODEL_KEY_ENCRYPTION_KEY_BYTES} bytes encoded in base64` })),
  EMBEDDING_API_KEY: settingOf(z.string()),
});

interface ModelSettings {
  NODE_ENV: string;
  MODEL_ADAPTER: string | null;
  MODEL_KEY_ENCRYPTION_KEY: string | null;
  EMBEDDING_API_KEY: string | null;
}

// The development stand-ins accept every key, encrypt with a key published in this repository, and
// embed with a digest instead of a model: that is what lets CI and the local stack run with no
// secret, and why production refuses them.
function requireProductionModelSettings(environment: ModelSettings, context: z.RefinementCtx): void {
  if (environment.NODE_ENV !== "production") {
    return;
  }

  if (environment.MODEL_ADAPTER === null) {
    context.addIssue({ code: "custom", path: ["MODEL_ADAPTER"], message: "is required in production" });
  }

  if (environment.MODEL_KEY_ENCRYPTION_KEY === null) {
    context.addIssue({ code: "custom", path: ["MODEL_KEY_ENCRYPTION_KEY"], message: "is required in production" });
  } else if (decodeEncryptionKey(environment.MODEL_KEY_ENCRYPTION_KEY).equals(DEVELOPMENT_MODEL_KEY_ENCRYPTION_KEY)) {
    context.addIssue({ code: "custom", path: ["MODEL_KEY_ENCRYPTION_KEY"], message: "must not be the development key in production" });
  }

  if (environment.EMBEDDING_API_KEY === null) {
    context.addIssue({ code: "custom", path: ["EMBEDDING_API_KEY"], message: "is required in production" });
  }
}

export const EnvironmentSchema = DatabaseEnvironmentSchema.extend(QueueEnvironmentSchema.shape)
  .extend(StorageEnvironmentSchema.shape)
  .extend(ModelEnvironmentSchema.shape)
  .extend({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce
      .number({ error: "must be a number" })
      .int({ error: "must be a whole number" })
      .min(1, portRange)
      .max(65535, portRange)
      .default(3001),
    WEB_ORIGIN: z.url({ error: requiredOr("must be an absolute URL") }),
  })
  .superRefine(requireProductionModelSettings);

export type Environment = z.infer<typeof EnvironmentSchema>;
