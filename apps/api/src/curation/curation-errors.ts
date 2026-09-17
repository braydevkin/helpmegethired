import type { CurationActionErrorCode, CurationStatus, Id } from "@helpmegethired/shared";

export class CurationActionRefusedError extends Error {
  constructor(
    readonly code: CurationActionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CurationActionRefusedError";
  }
}

export class CurationNotFoundError extends Error {
  constructor(curationId: Id) {
    super(`No Curation ${curationId}`);
    this.name = "CurationNotFoundError";
  }
}

// Thrown so the queue retries the job with its backoff; a failed unit carries its own reason.
export class CurationAttemptFailedError extends Error {
  constructor(curationId: Id, status: CurationStatus | undefined) {
    super(`Curation ${curationId} ended its attempt without completing; now ${status ?? "unknown"}`);
    this.name = "CurationAttemptFailedError";
  }
}
