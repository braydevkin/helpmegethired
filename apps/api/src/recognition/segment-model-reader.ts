import { Injectable, Logger } from "@nestjs/common";
import type { Id, SegmentRecognition, SegmentRecognitionKind } from "@helpmegethired/shared";

import { ModelKeyNotFoundError } from "../model-choice/model-choice-errors";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import type { UsableModelKey } from "../model-choice/model-key";
import { RecognitionModel } from "./recognition-model";

export interface SegmentToRead<Kind extends SegmentRecognitionKind> {
  accountId: Id;
  kind: Kind;
  lines: readonly string[];
}

// The Candidate's Model reads a Segment only on the Candidate's own Model Key: an Account without
// one is read by the rules alone. A failed call is thrown, so the Ingestion's attempts apply.
// Log lines carry the Account, the kind, and the token counts, never the key or the text.
@Injectable()
export class SegmentModelReader {
  private readonly logger = new Logger(SegmentModelReader.name);

  constructor(
    private readonly choices: ModelChoiceService,
    private readonly model: RecognitionModel,
  ) {}

  async read<Kind extends SegmentRecognitionKind>({ accountId, kind, lines }: SegmentToRead<Kind>): Promise<SegmentRecognition<Kind> | null> {
    const usableKey = await this.usableKeyOf(accountId);

    if (usableKey === null) {
      return null;
    }

    const started = performance.now();
    const { output, usage } = await this.model.recognize({ kind, lines, modelId: usableKey.modelId, modelKey: usableKey.key });

    this.logger.log(
      `segment read by model account=${accountId} kind=${kind} model=${usableKey.provider}/${usableKey.modelId} ` +
        `input_tokens=${usage.inputTokens} output_tokens=${usage.outputTokens} latency_ms=${Math.round(performance.now() - started)}`,
    );

    return output;
  }

  private async usableKeyOf(accountId: Id): Promise<UsableModelKey | null> {
    try {
      return await this.choices.usableModelKey(accountId);
    } catch (error) {
      if (error instanceof ModelKeyNotFoundError) {
        return null;
      }

      throw error;
    }
  }
}
