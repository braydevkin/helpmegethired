import { describe, expect, it } from "vitest";

import { ModelKey } from "../model-choice/model-key";
import { MissingModelAdapterError } from "../model-choice/select-model-key-validator";
import { AnthropicRecognitionModel } from "./anthropic-recognition-model";
import { FakeRecognitionModel } from "./fake-recognition-model";
import { selectRecognitionModel } from "./select-recognition-model";

describe("selectRecognitionModel", () => {
  it("selects Anthropic when the platform names it", () => {
    expect(selectRecognitionModel({ NODE_ENV: "production", MODEL_ADAPTER: "anthropic" })).toBeInstanceOf(AnthropicRecognitionModel);
  });

  it.each(["development", "test"] as const)("selects the fake outside production when no adapter is configured (%s)", (environment) => {
    expect(selectRecognitionModel({ NODE_ENV: environment, MODEL_ADAPTER: null })).toBeInstanceOf(FakeRecognitionModel);
  });

  it("refuses to start production with no adapter, never falling back to the fake", () => {
    expect(() => selectRecognitionModel({ NODE_ENV: "production", MODEL_ADAPTER: null })).toThrow(MissingModelAdapterError);
  });

  it("recognizes offline with nothing configured", async () => {
    const model = selectRecognitionModel({ NODE_ENV: "test", MODEL_ADAPTER: null });
    const { output } = await model.recognize({
      kind: "languages",
      lines: ["English - Native"],
      modelId: "claude-sonnet-5",
      modelKey: new ModelKey("sk-ant-development-key-000000"),
    });

    expect(output.languages).toEqual([{ name: { value: "English", quote: "English" }, level: { value: "Native", quote: "Native" } }]);
  });
});
