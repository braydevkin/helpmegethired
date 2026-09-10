import type { Environment } from "../../config/environment.schema";
import { MissingModelAdapterError } from "../../model-choice/select-model-key-validator";
import { AnthropicCurationModel } from "./anthropic-curation-model";
import type { CurationModel } from "./curation-model";
import { FakeCurationModel } from "./fake-curation-model";

// The same setting that selects the Model Key check (#110): platform configuration chooses the
// adapter, never the presence of a Candidate's key (ADR-0023).
export function selectCurationModel(environment: Pick<Environment, "NODE_ENV" | "MODEL_ADAPTER">): CurationModel {
  if (environment.MODEL_ADAPTER === "anthropic") {
    return new AnthropicCurationModel();
  }

  if (environment.NODE_ENV === "production") {
    throw new MissingModelAdapterError();
  }

  return new FakeCurationModel();
}
