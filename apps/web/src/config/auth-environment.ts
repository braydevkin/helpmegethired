import { z, type ZodError } from "zod";

const AUTH_SECRET_MIN_LENGTH = 32;

// "Name <address@domain>" or a bare address, as Resend accepts for the sender.
const SENDER_ADDRESS_PATTERN = /^(?:[^<>@]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

const requiredOr = (invalid: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? "is required" : invalid;

const blankAsUnset = (value: unknown) => (value === "" ? undefined : value);

export const AuthEnvironmentSchema = z
  .object({
    AUTH_SECRET: z
      .string({ error: requiredOr("must be a string") })
      .min(AUTH_SECRET_MIN_LENGTH, { error: `must have at least ${AUTH_SECRET_MIN_LENGTH} characters` }),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: requiredOr("must be a PostgreSQL connection URL"),
    }),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    AUTH_RESEND_KEY: z.preprocess(blankAsUnset, z.string({ error: "must be a string" }).optional()),
    EMAIL_FROM: z.preprocess(
      blankAsUnset,
      z
        .string({ error: "must be a string" })
        .regex(SENDER_ADDRESS_PATTERN, {
          error: "must be an email address, optionally with a display name: Help Me Get Hired <no-reply@example.com>",
        })
        .optional(),
    ),
  })
  .check((context) => {
    if (context.value.AUTH_RESEND_KEY !== undefined && context.value.EMAIL_FROM === undefined) {
      context.issues.push({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "is required when AUTH_RESEND_KEY is set",
        input: context.value.EMAIL_FROM,
      });
    }
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
