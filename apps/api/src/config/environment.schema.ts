import { z } from "zod";

const portRange = { error: "must be between 1 and 65535" };

export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce
    .number({ error: "must be a number" })
    .int({ error: "must be a whole number" })
    .min(1, portRange)
    .max(65535, portRange)
    .default(3001),
  WEB_ORIGIN: z.url({
    error: (issue) => (issue.input === undefined ? "is required" : "must be an absolute URL"),
  }),
});

export type Environment = z.infer<typeof EnvironmentSchema>;
