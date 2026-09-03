import { z, type ZodError } from "zod";

const AUTH_SECRET_MIN_LENGTH = 32;

const requiredOr = (invalid: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? "is required" : invalid;

export const AuthEnvironmentSchema = z.object({
  AUTH_SECRET: z
    .string({ error: requiredOr("must be a string") })
    .min(AUTH_SECRET_MIN_LENGTH, { error: `must have at least ${AUTH_SECRET_MIN_LENGTH} characters` }),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: requiredOr("must be a PostgreSQL connection URL"),
  }),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AuthEnvironment = z.infer<typeof AuthEnvironmentSchema>;

export class AuthEnvironmentError extends Error {
  constructor(error: ZodError) {
    super(describe(error));
    this.name = "AuthEnvironmentError";
  }
}

export function readAuthEnvironment(variables: Record<string, unknown> = process.env): AuthEnvironment {
  const result = AuthEnvironmentSchema.safeParse(variables);

  if (!result.success) {
    throw new AuthEnvironmentError(result.error);
  }

  return result.data;
}

function describe(error: ZodError): string {
  const problems = error.issues.map((issue) => `  - ${issue.path.join(".")} ${issue.message}`);

  return ["Invalid environment configuration:", ...problems].join("\n");
}
