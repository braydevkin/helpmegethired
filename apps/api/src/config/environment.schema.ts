import { z } from "zod";

const portRange = { error: "must be between 1 and 65535" };

const requiredOr = (invalid: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? "is required" : invalid;

export const DatabaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: requiredOr("must be a PostgreSQL connection URL"),
  }),
});

export type DatabaseEnvironment = z.infer<typeof DatabaseEnvironmentSchema>;

export const EnvironmentSchema = DatabaseEnvironmentSchema.extend({
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
