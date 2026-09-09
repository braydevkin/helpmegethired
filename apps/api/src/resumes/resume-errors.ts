import type { Id } from "@helpmegethired/shared";

export class UploadedResumeNotFoundError extends Error {
  constructor(id: Id) {
    super(`No Uploaded Resume with the id ${id}`);
    this.name = "UploadedResumeNotFoundError";
  }
}

export class UploadIncompleteError extends Error {
  constructor(id: Id) {
    super(`The object of the Uploaded Resume ${id} is missing or has another size`);
    this.name = "UploadIncompleteError";
  }
}

export class UploadInFlightError extends Error {
  constructor(accountId: Id) {
    super(`The Account ${accountId} already has an upload or an Ingestion in flight`);
    this.name = "UploadInFlightError";
  }
}
