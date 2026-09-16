import type { ModelId, SegmentRecognitionKind } from "@helpmegethired/shared";

import { anthropicStructuredModel, structuredAnswerOf, type StructuredModel } from "../curation/model/anthropic-structured-call";
import { RecognitionModel, type RecognitionAnswer, type RecognitionCall } from "./recognition-model";
import { recognitionMessagesOf } from "./recognition-prompt";
import { recognitionSchemaOf } from "./recognition-schema";

// Every value is answered twice, once tidied and once as its verbatim quote, so a Segment at the
// input cap needs about twice the room of its own text.
export const RECOGNITION_MAX_OUTPUT_TOKENS = 16_000;

export type StructuredRecognitionModelFactory = (apiKey: string, modelId: ModelId, kind: SegmentRecognitionKind) => StructuredModel;

export const anthropicRecognitionModel: StructuredRecognitionModelFactory = (apiKey, modelId, kind) =>
  anthropicStructuredModel({ apiKey, modelId, maxOutputTokens: RECOGNITION_MAX_OUTPUT_TOKENS }, recognitionSchemaOf(kind));

export class AnthropicRecognitionModel extends RecognitionModel {
  constructor(private readonly structuredModelOf: StructuredRecognitionModelFactory = anthropicRecognitionModel) {
    super();
  }

  async recognize<Kind extends SegmentRecognitionKind>({ kind, lines, modelId, modelKey }: RecognitionCall<Kind>): Promise<RecognitionAnswer<Kind>> {
    return structuredAnswerOf(this.structuredModelOf(modelKey.reveal(), modelId, kind), recognitionMessagesOf(kind, lines), recognitionSchemaOf(kind));
  }
}
