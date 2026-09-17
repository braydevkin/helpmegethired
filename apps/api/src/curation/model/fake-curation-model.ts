import { CURATION_UNIT_INPUT_MAX_CHARACTERS, CurationUnitKindSchema, CurationUnitOutputSchema, type CurationUnitOutput } from "@helpmegethired/shared";

import { instructionsFor } from "../curation-prompts";
import { CurationModel, type CurationAnswer, type CurationCall, type TokenUsage } from "./curation-model";
import { curationMessagesOf, type CurationPrompt } from "./curation-prompt";
import { estimatedTokensOf, keyScriptOf, scriptedFailureOf, type KeyScriptableOutcome } from "./fake-key-script";

export type FakeCurationOutcome = "answer" | "echo" | KeyScriptableOutcome;

const FIRST_SENTENCE = /\S[^\n.!?]*[.!?]?/u;

// The runner gives each kind of unit its own instructions, which is how the fake tells them apart.
function keyScriptedOutcomeOf({ prompt, modelKey }: CurationCall): FakeCurationOutcome {
  const script = keyScriptOf(modelKey);
  const unitKind = CurationUnitKindSchema.safeParse(script?.kind);

  return script && unitKind.success && prompt.instructions === instructionsFor(unitKind.data) ? script.outcome : "answer";
}

// One Statement per source: its first sentence, cited by the source's kind and id, so the quote is
// always found in the text it names and the Evidence resolves.
function outputOf(prompt: CurationPrompt, echoed: string | null): CurationUnitOutput {
  const statements = prompt.sources.flatMap((source) => {
    const quote = FIRST_SENTENCE.exec(source.text)?.[0].trimEnd().slice(0, CURATION_UNIT_INPUT_MAX_CHARACTERS);

    return quote
      ? [{ text: echoed ?? quote, labels: [source.kind], evidence: [{ kind: source.kind, referenceId: source.referenceId, quote }] }]
      : [];
  });

  return CurationUnitOutputSchema.parse({ statements });
}

// Stands in for the Provider outside production (ADR-0023). The answer is derived from the prompt
// alone, so the same prompt always gives the same Statements, and a scripted outcome reaches every
// failure path without a Provider. `echo` answers with the system instructions, which is how a
// test proves its leak check catches a model that repeats its prompt.
export class FakeCurationModel extends CurationModel {
  private readonly scripted: FakeCurationOutcome[];

  constructor(scripted: readonly FakeCurationOutcome[] = []) {
    super();
    this.scripted = [...scripted];
  }

  generate(call: CurationCall): Promise<CurationAnswer> {
    const { prompt } = call;
    const outcome = this.scripted.shift() ?? keyScriptedOutcomeOf(call);
    const { system, user } = curationMessagesOf(prompt);
    const spent: TokenUsage = { inputTokens: estimatedTokensOf(system + user), outputTokens: 0 };

    if (outcome !== "answer" && outcome !== "echo") {
      return Promise.reject(scriptedFailureOf(outcome, spent));
    }

    const output = outputOf(prompt, outcome === "echo" ? system : null);

    return Promise.resolve({ output, usage: { ...spent, outputTokens: estimatedTokensOf(JSON.stringify(output)) } });
  }
}
