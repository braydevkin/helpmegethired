import { describe, expect, it } from "vitest";

import { MissingModelAdapterError } from "../../model-choice/select-model-key-validator";
import { ModelKey } from "../../model-choice/model-key";
import { AnthropicCurationModel } from "./anthropic-curation-model";
import { FakeCurationModel } from "./fake-curation-model";
import { FakeEmbeddingModel } from "./fake-embedding-model";
import { OpenAiEmbeddingModel } from "./openai-embedding-model";
import { selectCurationModel } from "./select-curation-model";
import { MissingEmbeddingKeyError, selectEmbeddingModel } from "./select-embedding-model";

describe("selectCurationModel", () => {
  it("selects Anthropic when the platform names it", () => {
    expect(selectCurationModel({ NODE_ENV: "production", MODEL_ADAPTER: "anthropic" })).toBeInstanceOf(AnthropicCurationModel);
  });

  it.each(["development", "test"] as const)("selects the fake outside production when no adapter is configured (%s)", (environment) => {
    expect(selectCurationModel({ NODE_ENV: environment, MODEL_ADAPTER: null })).toBeInstanceOf(FakeCurationModel);
  });

  it("refuses to start production with no adapter, never falling back to the fake", () => {
    expect(() => selectCurationModel({ NODE_ENV: "production", MODEL_ADAPTER: null })).toThrow(MissingModelAdapterError);
  });

  it("curates offline with nothing configured", async () => {
    const model = selectCurationModel({ NODE_ENV: "test", MODEL_ADAPTER: null });
    const { output } = await model.generate({
      prompt: {
        version: "experience/1",
        instructions: "Write self-contained Statements about the Candidate.",
        facts: { careerDuration: { years: 1, months: 0 }, durationPerCompany: [], counts: { roles: 1, projects: 0, certifications: 0, languages: 0, education: 0 } },
        sources: [{ kind: "experience", referenceId: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b", title: "Platform Engineer", text: "Runs the deployment platform." }],
      },
      modelId: "claude-sonnet-5",
      modelKey: new ModelKey("sk-ant-development-key-000000"),
    });

    expect(output.statements).toHaveLength(1);
  });
});

describe("selectEmbeddingModel", () => {
  it("embeds on the platform key when it is configured", () => {
    expect(selectEmbeddingModel({ NODE_ENV: "production", EMBEDDING_API_KEY: "platform-embedding-key" })).toBeInstanceOf(OpenAiEmbeddingModel);
  });

  it("selects the fake outside production when no key is configured", () => {
    expect(selectEmbeddingModel({ NODE_ENV: "development", EMBEDDING_API_KEY: null })).toBeInstanceOf(FakeEmbeddingModel);
  });

  it("refuses to start production with no platform embedding key", () => {
    expect(() => selectEmbeddingModel({ NODE_ENV: "production", EMBEDDING_API_KEY: null })).toThrow(MissingEmbeddingKeyError);
  });
});
