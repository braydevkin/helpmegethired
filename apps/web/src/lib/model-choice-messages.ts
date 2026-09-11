import { MODEL_KEY_MIN_LENGTH, type ModelChoiceErrorCode } from "@helpmegethired/shared";

import { ModelChoiceRefusedError } from "./model-choice-refused-error";

export const TICKET_FAILED_MESSAGE = "We couldn't start saving your key. Try again in a moment.";
export const REVOKE_FAILED_MESSAGE = "We couldn't revoke your key. Try again in a moment.";
export const SAVE_FAILED_MESSAGE = "We couldn't save your key. Check your connection and try again.";

export const keyShapeMessageOf = (providerName: string): string =>
  `That doesn't look like a whole ${providerName} API key. A key has at least ${MODEL_KEY_MIN_LENGTH} characters, so paste all of it.`;

const refusalMessagesFor = (providerName: string): Record<ModelChoiceErrorCode, string> => ({
  model_key_invalid: `${providerName} doesn't accept this key. Check that you copied all of it, or create a new one.`,
  model_key_not_permitted: `${providerName} accepts this key but doesn't let it use the pinned model. Check the key's permissions in your ${providerName} console.`,
  provider_unavailable: `We couldn't reach ${providerName} to check the key. Try again in a moment.`,
  model_key_ticket_invalid: "That took too long, so your key was not checked. Try again.",
  unsupported_model_choice: "This model can't be chosen. Reload the page and try again.",
  model_key_missing: "Add your API key to continue.",
});

// The page's own words for each code, so nothing a Provider or a proxy wrote reaches the Candidate.
export function saveFailureMessageOf(error: unknown, providerName: string): string {
  if (!(error instanceof ModelChoiceRefusedError)) {
    return SAVE_FAILED_MESSAGE;
  }

  if (error.code) {
    return refusalMessagesFor(providerName)[error.code];
  }

  return error.status === 400 ? keyShapeMessageOf(providerName) : SAVE_FAILED_MESSAGE;
}
