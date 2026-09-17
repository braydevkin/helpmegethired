import { ModelKeyValidator, type ModelKeyVerdict } from "./model-key-validator";

export const DEVELOPMENT_REFUSED_MODEL_KEY = "sk-ant-development-refused-key";
export const DEVELOPMENT_UNAVAILABLE_MODEL_KEY = "sk-ant-development-unavailable-key";

// Stands in for the Provider outside production, so CI and the local stack save a key with no
// Provider account. The two documented keys let a test reach the refusal and the outage paths.
export class DevelopmentModelKeyValidator extends ModelKeyValidator {
  validate(_target: unknown, modelKey: string): Promise<ModelKeyVerdict> {
    if (modelKey === DEVELOPMENT_REFUSED_MODEL_KEY) {
      return Promise.resolve("invalid");
    }

    return Promise.resolve(modelKey === DEVELOPMENT_UNAVAILABLE_MODEL_KEY ? "unavailable" : "valid");
  }
}
