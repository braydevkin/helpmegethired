import type { Id, ModelChoiceErrorCode } from "@helpmegethired/shared";

export type ModelKeyRefusal = Extract<ModelChoiceErrorCode, "model_key_invalid" | "model_key_not_permitted" | "provider_unavailable">;

const REFUSAL_MESSAGES: Record<ModelKeyRefusal, string> = {
  model_key_invalid: "The Provider does not accept this key",
  model_key_not_permitted: "The Provider accepts this key but does not let it use the chosen model",
  provider_unavailable: "The Provider could not be reached to check the key; try again shortly",
};

export class ModelKeyRefusedError extends Error {
  constructor(readonly code: ModelKeyRefusal) {
    super(REFUSAL_MESSAGES[code]);
    this.name = "ModelKeyRefusedError";
  }
}

export class ModelChoiceNotFoundError extends Error {
  constructor(accountId: Id) {
    super(`The Account ${accountId} has no Model Choice`);
    this.name = "ModelChoiceNotFoundError";
  }
}

// One answer for an unknown, an expired, and a used ticket, so a caller learns nothing about
// which tickets exist.
export class ModelKeyTicketInvalidError extends Error {
  readonly code = "model_key_ticket_invalid" satisfies ModelChoiceErrorCode;

  constructor() {
    super("The Model Key ticket is unknown, expired, or already used; ask for a new one");
    this.name = "ModelKeyTicketInvalidError";
  }
}

export class ModelKeyNotFoundError extends Error {
  readonly code = "model_key_missing" satisfies ModelChoiceErrorCode;

  constructor(accountId: Id) {
    super(`The Account ${accountId} has no Model Key; supply one to run an analysis`);
    this.name = "ModelKeyNotFoundError";
  }
}
