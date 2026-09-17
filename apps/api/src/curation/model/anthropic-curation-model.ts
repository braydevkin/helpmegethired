import { CurationUnitOutputSchema, type ModelId } from "@helpmegethired/shared";

import { anthropicStructuredModel, structuredAnswerOf, type StructuredModel } from "./anthropic-structured-call";
import { CurationModel, type CurationAnswer, type CurationCall } from "./curation-model";
import { curationMessagesOf } from "./curation-prompt";

export const MAX_OUTPUT_TOKENS = 8192;

export type StructuredModelFactory = (apiKey: string, modelId: ModelId) => StructuredModel;

const anthropicCurationModel: StructuredModelFactory = (apiKey, modelId) =>
  anthropicStructuredModel({ apiKey, modelId, maxOutputTokens: MAX_OUTPUT_TOKENS }, CurationUnitOutputSchema);

export class AnthropicCurationModel extends CurationModel {
  constructor(private readonly structuredModelOf: StructuredModelFactory = anthropicCurationModel) {
    super();
  }

  async generate({ prompt, modelId, modelKey }: CurationCall): Promise<CurationAnswer> {
    return structuredAnswerOf(this.structuredModelOf(modelKey.reveal(), modelId), curationMessagesOf(prompt), CurationUnitOutputSchema);
  }
}
