import type { SegmentRecognitionKind } from "@helpmegethired/shared";

import type { TokenUsage } from "../curation/model/curation-model";
import { estimatedTokensOf, keyScriptOf, scriptedFailureOf, type KeyScriptableOutcome } from "../curation/model/fake-key-script";
import { recognitionByRules } from "./recognition-by-rules";
import { RecognitionModel, type RecognitionAnswer, type RecognitionCall } from "./recognition-model";
import { recognitionMessagesOf } from "./recognition-prompt";

export type FakeRecognitionOutcome = "answer" | KeyScriptableOutcome;

// A key such as `sk-ant-fake-timeout-on-experience` plays its outcome for every Segment of that kind.
function keyScriptedOutcomeOf({ kind, modelKey }: RecognitionCall<SegmentRecognitionKind>): FakeRecognitionOutcome {
  const script = keyScriptOf(modelKey);

  return script?.kind === kind ? script.outcome : "answer";
}

// Stands in for the Provider outside production (ADR-0023). It answers what the deterministic
// rules read from the same lines, with quotes cut verbatim from them, so the stack builds the
// same Profile offline that the rules alone would, and a scripted outcome reaches every failure
// path without a Provider.
export class FakeRecognitionModel extends RecognitionModel {
  private readonly scripted: FakeRecognitionOutcome[];

  constructor(scripted: readonly FakeRecognitionOutcome[] = []) {
    super();
    this.scripted = [...scripted];
  }

  recognize<Kind extends SegmentRecognitionKind>(call: RecognitionCall<Kind>): Promise<RecognitionAnswer<Kind>> {
    const { kind, lines } = call;
    const outcome = this.scripted.shift() ?? keyScriptedOutcomeOf(call);
    const { system, user } = recognitionMessagesOf(kind, lines);
    const spent: TokenUsage = { inputTokens: estimatedTokensOf(system + user), outputTokens: 0 };

    if (outcome !== "answer") {
      return Promise.reject(scriptedFailureOf(outcome, spent));
    }

    const output = recognitionByRules(kind, lines);

    return Promise.resolve({ output, usage: { ...spent, outputTokens: estimatedTokensOf(JSON.stringify(output)) } });
  }
}
