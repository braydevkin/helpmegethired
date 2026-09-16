import type { Environment } from "../config/environment.schema";
import type { RecognitionModel } from "./recognition-model";

// Chosen by the same MODEL_ADAPTER setting as the Curation's model, never by the presence of a
// Candidate's key (ADR-0023).
export function selectRecognitionModel(environment: Pick<Environment, "NODE_ENV" | "MODEL_ADAPTER">): RecognitionModel {
  throw new Error(`No recognition model is built yet for MODEL_ADAPTER=${environment.MODEL_ADAPTER ?? "unset"}`);
}
