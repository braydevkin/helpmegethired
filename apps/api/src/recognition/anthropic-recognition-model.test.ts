import { AIMessage } from "@langchain/core/messages";
import { SEGMENT_RECOGNITION_SCHEMAS, type SegmentRecognitionKind } from "@helpmegethired/shared";
import { describe, expect, it, vi } from "vitest";

import type { RawStructuredAnswer, StructuredModel } from "../curation/model/anthropic-structured-call";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "../curation/model/curation-model-errors";
import { ModelKey } from "../model-choice/model-key";
import { AnthropicRecognitionModel, anthropicRecognitionModel, type StructuredRecognitionModelFactory } from "./anthropic-recognition-model";
import type { RecognitionCall } from "./recognition-model";

const call: RecognitionCall<"languages"> = {
  kind: "languages",
  lines: ["English - Native", "French - Intermediate (B1)"],
  modelId: "claude-sonnet-5",
  modelKey: new ModelKey("sk-ant-api03-candidate-key"),
};

const parsed = {
  languages: [
    { name: { value: "English", quote: "English" }, level: { value: "Native", quote: "Native" } },
    { name: { value: "French", quote: "French" }, level: { value: "Intermediate (B1)", quote: "Intermediate (B1)" } },
  ],
};

const answerOf = (output: unknown, stopReason = "end_turn"): RawStructuredAnswer => ({
  raw: new AIMessage({ content: "", response_metadata: { stop_reason: stopReason }, usage_metadata: { input_tokens: 90, output_tokens: 30, total_tokens: 120 } }),
  parsed: output,
});

function modelAnswering(outcome: () => Promise<RawStructuredAnswer>) {
  const invoke = vi.fn<StructuredModel["invoke"]>(outcome);
  const factory = vi.fn<StructuredRecognitionModelFactory>(() => ({ invoke }));

  return { model: new AnthropicRecognitionModel(factory), factory, invoke };
}

describe("AnthropicRecognitionModel", () => {
  it("calls the pinned model for the Segment's kind with the Candidate's own key and the fenced lines", async () => {
    const { model, factory, invoke } = modelAnswering(() => Promise.resolve(answerOf(parsed)));

    await model.recognize(call);

    expect(factory).toHaveBeenCalledWith("sk-ant-api03-candidate-key", "claude-sonnet-5", "languages");
    const [messages, options] = invoke.mock.calls[0] ?? [];
    expect(messages?.map(([role]) => role)).toEqual(["system", "human"]);
    expect(messages?.[1]?.[1]).toBe("<candidate_content>\nEnglish - Native\nFrench - Intermediate (B1)\n</candidate_content>");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("answers the validated output with the tokens the call spent", async () => {
    const { model } = modelAnswering(() => Promise.resolve(answerOf(parsed)));

    await expect(model.recognize(call)).resolves.toEqual({ output: parsed, usage: { inputTokens: 90, outputTokens: 30 } });
  });

  it.each([
    ["a response cut off at the output limit", answerOf(null, "max_tokens"), "truncated_response"],
    ["a response that could not be parsed", answerOf(null), "invalid_output"],
    ["a response for another kind of Segment", answerOf({ skills: [] }), "invalid_output"],
    ["a value without its quote", answerOf({ languages: [{ name: { value: "English" }, level: null }] }), "invalid_output"],
  ])("fails the call on %s, keeping the tokens it spent", async (_label, answer, outcome) => {
    const { model } = modelAnswering(() => Promise.resolve(answer));

    await expect(model.recognize(call)).rejects.toMatchObject({ name: CurationCallFailedError.name, outcome, usage: { inputTokens: 90, outputTokens: 30 } });
  });

  const providerError = (status: number, headers?: Record<string, string>) =>
    Object.assign(new Error("Provider says: your key sk-ant-api03-candidate-key and this Resume text were refused"), { status, headers: new Headers(headers) });

  it.each([
    ["a rate limit with retry-after", providerError(429, { "retry-after": "12" }), new ProviderRateLimitedError(12)],
    ["a rejected key", providerError(401), new ModelKeyRejectedError()],
    ["a timeout", Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }), new CurationCallFailedError("timeout")],
    ["any other failure", providerError(500), new CurationCallFailedError("provider_error")],
  ])("turns %s into an error that carries nothing the Provider said", async (_label, thrown, expected) => {
    const { model } = modelAnswering(() => Promise.reject(thrown));
    const failure = await model.recognize(call).catch((error: unknown) => error);

    expect(failure).toEqual(expected);
    expect(String((failure as Error).message)).not.toMatch(/sk-ant|Resume text|Provider says/);
  });

  // The Provider's JSON schema has no length, pattern or range keywords; building the model is where
  // the shared schema is converted, so a kind whose schema cannot be sent fails here, offline.
  it.each(Object.keys(SEGMENT_RECOGNITION_SCHEMAS) as SegmentRecognitionKind[])("builds the structured model for a %s Segment", (kind) => {
    expect(() => anthropicRecognitionModel("sk-ant-api03-never-sent", "claude-sonnet-5", kind)).not.toThrow();
  });
});
