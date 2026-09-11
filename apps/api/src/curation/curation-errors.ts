import type { CurationStatus, Id } from "@helpmegethired/shared";

export class CurationNotFoundError extends Error {
  constructor(curationId: Id) {
    super(`No Curation ${curationId}`);
    this.name = "CurationNotFoundError";
  }
}

// Thrown so the queue retries the job with its backoff; the units that failed carry the reason.
export class CurationAttemptFailedError extends Error {
  constructor(curationId: Id, status: CurationStatus | undefined) {
    super(`Curation ${curationId} ended its attempt with a failed unit; now ${status ?? "unknown"}`);
    this.name = "CurationAttemptFailedError";
  }
}
