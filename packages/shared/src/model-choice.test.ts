import { describe, expect, it } from "vitest";

import { MODEL_KEY_MAX_LENGTH, ModelChoiceRequestSchema, ModelChoiceStateSchema } from "./model-choice.js";

const request = { provider: "anthropic", modelId: "claude-sonnet-5", key: "sk-ant-api03-example-key-for-the-schema" };

describe("ModelChoiceRequestSchema", () => {
  it("accepts the catalogue pairing with a key", () => {
    expect(ModelChoiceRequestSchema.parse(request)).toEqual(request);
  });

  it("trims the key the Candidate pasted", () => {
    expect(ModelChoiceRequestSchema.parse({ ...request, key: `  ${request.key}\n` }).key).toBe(request.key);
  });

  it.each([
    ["another provider", { ...request, provider: "openai" }],
    ["a model outside the catalogue", { ...request, modelId: "claude-opus-5" }],
    ["a key too short to be one", { ...request, key: "sk-ant" }],
    ["a key longer than any Provider issues", { ...request, key: "k".repeat(MODEL_KEY_MAX_LENGTH + 1) }],
    ["no key", { provider: request.provider, modelId: request.modelId }],
    ["a field the route does not take", { ...request, keyStored: true }],
  ])("refuses %s", (_label, input) => {
    expect(ModelChoiceRequestSchema.safeParse(input).success).toBe(false);
  });

  it("names the field in a refusal without echoing the key", () => {
    const result = ModelChoiceRequestSchema.safeParse({ ...request, key: "sk-ant-short" });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain("sk-ant-short");
  });
});

describe("ModelChoiceStateSchema", () => {
  it("answers no choice before the Candidate makes one", () => {
    expect(ModelChoiceStateSchema.safeParse({ choice: null }).success).toBe(true);
  });

  it("answers the choice and whether a key is stored, never the key", () => {
    expect(ModelChoiceStateSchema.safeParse({ choice: { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: false } }).success).toBe(true);
    expect(ModelChoiceStateSchema.safeParse({ choice: { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true, key: request.key } }).success).toBe(
      false,
    );
  });
});
