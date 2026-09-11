import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";

import { ModelKey } from "../../model-choice/model-key";
import { AnthropicCurationModel, type RawStructuredAnswer, type StructuredCurationModel, type StructuredModelFactory } from "./anthropic-curation-model";
import type { CurationCall } from "./curation-model";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "./curation-model-errors";

const REFERENCE_ID = "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b";
const QUOTE = "Runs the deployment platform.";

const call: CurationCall = {
  prompt: {
    version: "experience/1",
    instructions: "Write self-contained Statements about the Candidate.",
    facts: { careerDuration: { years: 1, months: 0 }, durationPerCompany: [], counts: { roles: 1, projects: 0, certifications: 0, languages: 0, education: 0 } },
    sources: [{ kind: "experience", referenceId: REFERENCE_ID, title: "Platform Engineer", text: QUOTE }],
  },
  modelId: "claude-sonnet-5",
  modelKey: new ModelKey("sk-ant-api03-candidate-key"),
};

const parsed = { statements: [{ text: "Runs the deployment platform at Parapet Systems.", labels: ["platform"], evidence: [{ kind: "experience", referenceId: REFERENCE_ID, quote: QUOTE }] }] };

const answerOf = (output: unknown, stopReason = "end_turn"): RawStructuredAnswer => ({
  raw: new AIMessage({ content: "", response_metadata: { stop_reason: stopReason }, usage_metadata: { input_tokens: 120, output_tokens: 40, total_tokens: 160 } }),
  parsed: output,
});

function modelAnswering(outcome: () => Promise<RawStructuredAnswer>) {
  const invoke = vi.fn<StructuredCurationModel["invoke"]>(outcome);
  const factory = vi.fn<StructuredModelFactory>(() => ({ invoke }));

  return { model: new AnthropicCurationModel(factory), factory, invoke };
}

describe("AnthropicCurationModel", () => {
  it("calls the pinned model with the Candidate's own key, the instructions and the fenced content", async () => {
    const { model, factory, invoke } = modelAnswering(() => Promise.resolve(answerOf(parsed)));

    await model.generate(call);

    expect(factory).toHaveBeenCalledWith("sk-ant-api03-candidate-key", "claude-sonnet-5");
    const [messages, options] = invoke.mock.calls[0] ?? [];
    expect(messages?.map(([role]) => role)).toEqual(["system", "human"]);
    expect(messages?.[1]?.[1]).toContain("<candidate_content>");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("answers the validated output with the tokens the call spent", async () => {
    const { model } = modelAnswering(() => Promise.resolve(answerOf(parsed)));

    await expect(model.generate(call)).resolves.toEqual({ output: parsed, usage: { inputTokens: 120, outputTokens: 40 } });
  });

  it.each([
    ["a response cut off at the output limit", answerOf(null, "max_tokens"), "truncated_response"],
    ["a response that could not be parsed", answerOf(null), "invalid_output"],
    ["a response that fails the shared schema", answerOf({ statements: [{ ...parsed.statements[0], evidence: [] }] }), "invalid_output"],
  ])("fails the call on %s, keeping the tokens it spent", async (_label, answer, outcome) => {
    const { model } = modelAnswering(() => Promise.resolve(answer));

    await expect(model.generate(call)).rejects.toMatchObject({ name: CurationCallFailedError.name, outcome, usage: { inputTokens: 120, outputTokens: 40 } });
  });

  const providerError = (status: number, headers?: Record<string, string>) =>
    Object.assign(new Error("Provider says: your key sk-ant-api03-candidate-key and this Resume text were refused"), {
      status,
      headers: new Headers(headers),
    });

  it.each([
    ["a rate limit with retry-after", providerError(429, { "retry-after": "30" }), new ProviderRateLimitedError(30)],
    ["an overloaded Provider with no retry-after", providerError(529), new ProviderRateLimitedError(null)],
    ["a rejected key", providerError(401), new ModelKeyRejectedError()],
    ["a key not allowed the model", providerError(403), new ModelKeyRejectedError()],
    ["a timeout", Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }), new CurationCallFailedError("timeout")],
    ["any other failure", providerError(500), new CurationCallFailedError("provider_error")],
  ])("turns %s into an error that carries nothing the Provider said", async (_label, thrown, expected) => {
    const { model } = modelAnswering(() => Promise.reject(thrown));
    const failure = await model.generate(call).catch((error: unknown) => error);

    expect(failure).toEqual(expected);
    expect(String((failure as Error).message)).not.toMatch(/sk-ant|Resume text|Provider says/);
  });
});
