import type { Environment } from "../config/environment.schema";
import { MissingModelAdapterError } from "../model-choice/select-model-key-validator";
import { AnthropicRecognitionModel } from "./anthropic-recognition-model";
import { FakeRecognitionModel } from "./fake-recognition-model";
import type { RecognitionModel } from "./recognition-model";

// Chosen by the same MODEL_ADAPTER setting as the Curation's model, never by the presence of a
// Candidate's key (ADR-0023).
export function selectRecognitionModel(environment: Pick<Environment, "NODE_ENV" | "MODEL_ADAPTER">): RecognitionModel {
  if (environment.MODEL_ADAPTER === "anthropic") {
    return new AnthropicRecognitionModel();
  }

  if (environment.NODE_ENV === "production") {
    throw new MissingModelAdapterError();
  }

  return new FakeRecognitionModel();
}
