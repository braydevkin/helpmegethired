import { BadRequestException, HttpStatus, type PipeTransform } from "@nestjs/common";
import { ResumeUploadSchema, type ApiError, type ResumeUpload, type ResumeUploadErrorCode } from "@helpmegethired/shared";
import type { ZodError } from "zod";

const codeByField: Partial<Record<string, ResumeUploadErrorCode>> = {
  fileName: "not_pdf",
  sizeBytes: "too_large",
};

export function resumeUploadErrorCodeOf(error: ZodError): ResumeUploadErrorCode | undefined {
  for (const issue of error.issues) {
    const code = codeByField[String(issue.path[0])];

    if (code) {
      return code;
    }
  }

  return undefined;
}

// Same body as ZodValidationPipe, plus the code the upload page turns into a message.
export class ResumeUploadPipe implements PipeTransform<unknown, ResumeUpload> {
  transform(value: unknown): ResumeUpload {
    const result = ResumeUploadSchema.safeParse(value);

    if (!result.success) {
      const body: ApiError = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Validation failed",
        error: "Bad Request",
        code: resumeUploadErrorCodeOf(result.error),
        issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      };

      throw new BadRequestException(body);
    }

    return result.data;
  }
}
