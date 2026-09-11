import {
  CURATION_UNIT_INPUT_MAX_CHARACTERS,
  CurationUnitKindSchema,
  CurationUnitOutputSchema,
  type CurationUnitKind,
  type CurationUnitOutput,
} from "@helpmegethired/shared";

import type { ModelKey } from "../../model-choice/model-key";
import { instructionsFor } from "../curation-prompts";
import { CurationModel, type CurationAnswer, type CurationCall, type TokenUsage } from "./curation-model";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "./curation-model-errors";
import { curationMessagesOf, type CurationPrompt } from "./curation-prompt";

export type FakeCurationOutcome = "answer" | "echo" | "timeout" | "invalid_output" | "truncated_response" | "provider_error" | "rate_limited" | "key_rejected";

export const FAKE_RETRY_AFTER_SECONDS = 60;

const CHARACTERS_PER_TOKEN = 4;
const FIRST_SENTENCE = /\S[^\n.!?]*[.!?]?/u;

const KEY_SCRIPTABLE_OUTCOMES = [
  "timeout",
  "invalid_output",
  "truncated_response",
  "provider_error",
  "rate_limited",
  "key_rejected",
] as const satisfies readonly FakeCurationOutcome[];

// A key such as `sk-ant-fake-provider_error-on-synthesis` plays one outcome for one kind of unit,
// so an end-to-end test drives a single Candidate's Curation down a failure path while every other
// Candidate on the stack gets answers. Only the fake reads it, and production never selects the fake.
const KEY_SCRIPT = /^sk-ant-fake-([a-z_]+)-on-([a-z_]+)$/;

interface KeyScript {
  outcome: FakeCurationOutcome;
  kind: CurationUnitKind;
}

const tokensOf = (text: string): number => Math.ceil(text.length / CHARACTERS_PER_TOKEN);

function keyScriptOf(modelKey: ModelKey): KeyScript | undefined {
  const [, outcome, kind] = KEY_SCRIPT.exec(modelKey.reveal()) ?? [];
  const scripted = KEY_SCRIPTABLE_OUTCOMES.find((candidate) => candidate === outcome);
  const unitKind = CurationUnitKindSchema.safeParse(kind);

  return scripted && unitKind.success ? { outcome: scripted, kind: unitKind.data } : undefined;
}

// The runner gives each kind of unit its own instructions, which is how the fake tells them apart.
function keyScriptedOutcomeOf({ prompt, modelKey }: CurationCall): FakeCurationOutcome {
  const script = keyScriptOf(modelKey);

  return script && prompt.instructions === instructionsFor(script.kind) ? script.outcome : "answer";
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
    const spent: TokenUsage = { inputTokens: tokensOf(system + user), outputTokens: 0 };

    switch (outcome) {
      case "answer":
      case "echo": {
        const output = outputOf(prompt, outcome === "echo" ? system : null);

        return Promise.resolve({ output, usage: { ...spent, outputTokens: tokensOf(JSON.stringify(output)) } });
      }
      case "rate_limited":
        return Promise.reject(new ProviderRateLimitedError(FAKE_RETRY_AFTER_SECONDS));
      case "key_rejected":
        return Promise.reject(new ModelKeyRejectedError());
      default:
        return Promise.reject(new CurationCallFailedError(outcome, spent));
    }
  }
}
