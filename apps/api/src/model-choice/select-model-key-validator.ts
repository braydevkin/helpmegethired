import type { Environment } from "../config/environment.schema";
import { AnthropicModelKeyValidator } from "./anthropic-model-key-validator";
import { DevelopmentModelKeyValidator } from "./development-model-key-validator";
import type { ModelKeyValidator } from "./model-key-validator";

export class MissingModelAdapterError extends Error {
  constructor() {
    super("A production configuration needs a model adapter: set MODEL_ADAPTER to anthropic");
    this.name = "MissingModelAdapterError";
  }
}

type AdapterEnvironment = Pick<Environment, "NODE_ENV" | "MODEL_ADAPTER">;

// Platform configuration chooses the adapter, never the presence of a Candidate's key (ADR-0023).
export function selectModelKeyValidator(environment: AdapterEnvironment): ModelKeyValidator {
  if (environment.MODEL_ADAPTER === "anthropic") {
    return new AnthropicModelKeyValidator();
  }

  if (environment.NODE_ENV === "production") {
    throw new MissingModelAdapterError();
  }

  return new DevelopmentModelKeyValidator();
}
