import type { ZodError, ZodObject } from "zod";

import {
  DatabaseEnvironmentSchema,
  EnvironmentSchema,
  type DatabaseEnvironment,
  type Environment,
} from "./environment.schema";

export class EnvironmentValidationError extends Error {
  constructor(error: ZodError) {
    super(describe(error));
    this.name = "EnvironmentValidationError";
  }
}

export function validateEnvironment(variables: Record<string, unknown>): Environment {
  return parseWith(EnvironmentSchema, variables);
}

export function validateDatabaseEnvironment(variables: Record<string, unknown>): DatabaseEnvironment {
  return parseWith(DatabaseEnvironmentSchema, variables);
}

function parseWith<Schema extends ZodObject>(schema: Schema, variables: Record<string, unknown>) {
  const result = schema.safeParse(variables);

  if (!result.success) {
    throw new EnvironmentValidationError(result.error);
  }

  return result.data;
}

function describe(error: ZodError): string {
  const problems = error.issues.map((issue) => `  - ${issue.path.join(".")} ${issue.message}`);

  return ["Invalid environment configuration:", ...problems].join("\n");
}
