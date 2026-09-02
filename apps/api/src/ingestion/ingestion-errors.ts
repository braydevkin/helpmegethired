import type { Id } from "@helpmegethired/shared";

export class IngestionAlreadyActiveError extends Error {
  constructor(accountId: Id) {
    super(`The Account ${accountId} already has an active Ingestion`);
    this.name = "IngestionAlreadyActiveError";
  }
}

export class IngestionNotFoundError extends Error {
  constructor(ingestionId: Id) {
    super(`No Ingestion with the id ${ingestionId}`);
    this.name = "IngestionNotFoundError";
  }
}

export class UnknownSegmentKindError extends Error {
  constructor(kind: string) {
    super(`No SegmentProcessor handles the segment kind "${kind}"`);
    this.name = "UnknownSegmentKindError";
  }
}
