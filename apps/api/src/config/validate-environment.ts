import type { ZodError } from "zod";

import { EnvironmentSchema, type Environment } from "./environment.schema";

export class EnvironmentValidationError extends Error {
  constructor(error: ZodError) {
    super(describe(error));
    this.name = "EnvironmentValidationError";
  }
}

export function validateEnvironment(variables: Record<string, unknown>): Environment {
  const result = EnvironmentSchema.safeParse(variables);

  if (!result.success) {
    throw new EnvironmentValidationError(result.error);
  }

  return result.data;
}

function describe(error: ZodError): string {
  const problems = error.issues.map((issue) => `  - ${issue.path.join(".")} ${issue.message}`);

  return ["Invalid environment configuration:", ...problems].join("\n");
}
