import { inspect } from "node:util";

import type { ModelId, Provider } from "@helpmegethired/shared";

const REDACTED = "[Model Key]";

// Holds a decrypted key on its way to the Provider. Logging, serialising, or interpolating it
// shows a placeholder, so a key can only leave through an explicit `reveal()`.
export class ModelKey {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}

export interface UsableModelKey {
  provider: Provider;
  modelId: ModelId;
  key: ModelKey;
}
