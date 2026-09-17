import type { CurationUnitFailureReason } from "@helpmegethired/shared";

import type { TokenUsage } from "./curation-model";

// Every message here is fixed text: nothing a Provider says reaches an error, a log line, or a
// unit row, because a Provider's message can echo the input it refused (docs/security.md).

export class CurationCallFailedError extends Error {
  constructor(
    readonly outcome: CurationUnitFailureReason,
    readonly usage: TokenUsage | null = null,
  ) {
    super(`The model call produced no usable output: ${outcome}`);
    this.name = "CurationCallFailedError";
  }
}

// Says nothing about the input, so the Curation pauses until `retryAfterSeconds` instead of
// spending an attempt (ADR-0024).
export class ProviderRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number | null) {
    super("The Provider asked for a pause before the next call");
    this.name = "ProviderRateLimitedError";
  }
}

export class ModelKeyRejectedError extends Error {
  constructor() {
    super("The Provider refused the Model Key");
    this.name = "ModelKeyRejectedError";
  }
}
