import { BadRequestException, HttpStatus, type PipeTransform } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { z, ZodError, ZodType } from "zod";

export type ErrorCodeOf = (error: ZodError) => string | undefined;

export class ZodValidationPipe<Schema extends ZodType> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(
    private readonly schema: Schema,
    private readonly codeOf: ErrorCodeOf = () => undefined,
  ) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(validationErrorBody(result.error, this.codeOf(result.error)));
    }

    return result.data;
  }
}

export function validationErrorBody(error: ZodError, code?: string): ApiError {
  return {
    statusCode: HttpStatus.BAD_REQUEST,
    message: "Validation failed",
    error: "Bad Request",
    ...(code ? { code } : {}),
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  };
}
