import type { JobDescriptionErrorCode } from "@helpmegethired/shared";

export class JobDescriptionRefusedError extends Error {
  constructor(
    readonly code: JobDescriptionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JobDescriptionRefusedError";
  }
}
