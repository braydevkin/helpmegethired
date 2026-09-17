import type { CurationUnitOutput, ModelId } from "@helpmegethired/shared";

import type { ModelKey } from "../../model-choice/model-key";
import type { CurationPrompt } from "./curation-prompt";

export interface CurationCall {
  prompt: CurationPrompt;
  modelId: ModelId;
  modelKey: ModelKey;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CurationAnswer {
  output: CurationUnitOutput;
  usage: TokenUsage;
}

// One call per Curation Unit: a prompt in, and either output that validated against the shared
// schema or one of the errors in curation-model-errors.ts. No provider type crosses this line.
export abstract class CurationModel {
  abstract generate(call: CurationCall): Promise<CurationAnswer>;
}
