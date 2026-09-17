import type { ModelId, SegmentRecognition, SegmentRecognitionKind } from "@helpmegethired/shared";

import type { TokenUsage } from "../curation/model/curation-model";
import type { ModelKey } from "../model-choice/model-key";

export interface RecognitionCall<Kind extends SegmentRecognitionKind> {
  kind: Kind;
  lines: readonly string[];
  modelId: ModelId;
  modelKey: ModelKey;
}

export interface RecognitionAnswer<Kind extends SegmentRecognitionKind> {
  output: SegmentRecognition<Kind>;
  usage: TokenUsage;
}

// One call per Segment: its cleaned lines in, and either output that validated against the
// kind's shared schema or one of the errors in curation-model-errors.ts, which carry no
// Provider text. No provider type crosses this line.
export abstract class RecognitionModel {
  abstract recognize<Kind extends SegmentRecognitionKind>(call: RecognitionCall<Kind>): Promise<RecognitionAnswer<Kind>>;
}
