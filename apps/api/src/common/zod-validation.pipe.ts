import { BadRequestException, HttpStatus, type PipeTransform } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { z, ZodType } from "zod";

export class ZodValidationPipe<Schema extends ZodType> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const body: ApiError = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        error: "Bad Request",
        issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      };

      throw new BadRequestException(body);
    }

    return result.data;
  }
}
