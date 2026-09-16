import type { ModelKey } from "../../model-choice/model-key";
import type { TokenUsage } from "./curation-model";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "./curation-model-errors";

export const FAKE_RETRY_AFTER_SECONDS = 60;

const CHARACTERS_PER_TOKEN = 4;

export const KEY_SCRIPTABLE_OUTCOMES = ["timeout", "invalid_output", "truncated_response", "provider_error", "rate_limited", "key_rejected"] as const;

export type KeyScriptableOutcome = (typeof KEY_SCRIPTABLE_OUTCOMES)[number];

// A key such as `sk-ant-fake-provider_error-on-synthesis` plays one outcome for one kind of call,
// so an end-to-end test drives a single Candidate down a failure path while every other Candidate
// on the stack gets answers. Only the fakes read it, and production never selects a fake.
const KEY_SCRIPT = /^sk-ant-fake-([a-z_]+)-on-([a-z_]+)$/;

export interface KeyScript {
  outcome: KeyScriptableOutcome;
  kind: string;
}

export const estimatedTokensOf = (text: string): number => Math.ceil(text.length / CHARACTERS_PER_TOKEN);

export function keyScriptOf(modelKey: ModelKey): KeyScript | undefined {
  const [, outcome, kind] = KEY_SCRIPT.exec(modelKey.reveal()) ?? [];
  const scripted = KEY_SCRIPTABLE_OUTCOMES.find((candidate) => candidate === outcome);

  return scripted && kind ? { outcome: scripted, kind } : undefined;
}

export function scriptedFailureOf(outcome: KeyScriptableOutcome, spent: TokenUsage): Error {
  switch (outcome) {
    case "rate_limited":
      return new ProviderRateLimitedError(FAKE_RETRY_AFTER_SECONDS);
    case "key_rejected":
      return new ModelKeyRejectedError();
    default:
      return new CurationCallFailedError(outcome, spent);
  }
}
