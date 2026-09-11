import { describe, expect, it } from "vitest";

import { SAVE_FAILED_MESSAGE, keyShapeMessageOf, saveFailureMessageOf } from "./model-choice-messages";
import { ModelChoiceRefusedError } from "./model-choice-refused-error";

describe("saveFailureMessageOf", () => {
  it.each([
    ["model_key_invalid", 422, "Anthropic doesn't accept this key. Check that you copied all of it, or create a new one."],
    ["model_key_not_permitted", 422, "Anthropic accepts this key but doesn't let it use the pinned model. Check the key's permissions in your Anthropic console."],
    ["provider_unavailable", 503, "We couldn't reach Anthropic to check the key. Try again in a moment."],
    ["model_key_ticket_invalid", 401, "That took too long, so your key was not checked. Try again."],
  ] as const)("says what %s means for the Candidate", (code, status, message) => {
    expect(saveFailureMessageOf(new ModelChoiceRefusedError(code, status), "Anthropic")).toBe(message);
  });

  it("asks for the whole key when the API refused its shape", () => {
    expect(saveFailureMessageOf(new ModelChoiceRefusedError(undefined, 400), "Anthropic")).toBe(keyShapeMessageOf("Anthropic"));
    expect(keyShapeMessageOf("Anthropic")).toContain("at least 20 characters");
  });

  it.each([
    ["an unreachable API", new TypeError("Failed to fetch")],
    ["a proxy error page", new ModelChoiceRefusedError(undefined, 502)],
  ])("falls back to the page's own message for %s", (_label, error) => {
    expect(saveFailureMessageOf(error, "Anthropic")).toBe(SAVE_FAILED_MESSAGE);
  });
});
