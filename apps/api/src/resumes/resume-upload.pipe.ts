import { ResumeUploadSchema, type ResumeUploadErrorCode } from "@helpmegethired/shared";
import type { ZodError } from "zod";

import { ZodValidationPipe } from "../common/zod-validation.pipe";

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

// The usual validation body, plus the code the upload page turns into a message.
export class ResumeUploadPipe extends ZodValidationPipe<typeof ResumeUploadSchema> {
  constructor() {
    super(ResumeUploadSchema, resumeUploadErrorCodeOf);
  }
}
