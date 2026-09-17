import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseMessage } from "@langchain/core/messages";
import type { ModelId } from "@helpmegethired/shared";
import type { z } from "zod";

import type { TokenUsage } from "./curation-model";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "./curation-model-errors";

export const CALL_TIMEOUT_MS = 120_000;

export interface RawStructuredAnswer {
  raw: BaseMessage;
  parsed: unknown;
}

export interface StructuredModel {
  invoke(messages: [role: "system" | "human", content: string][], options: { signal: AbortSignal }): Promise<RawStructuredAnswer>;
}

export interface ModelMessages {
  system: string;
  user: string;
}

export interface StructuredAnswer<Output> {
  output: Output;
  usage: TokenUsage;
}

export interface AnthropicModelSettings {
  apiKey: string;
  modelId: ModelId;
  maxOutputTokens: number;
}

// Retries belong to the queue, which counts attempts and backs off. A retry inside the adapter
// would spend the Candidate's tokens behind the attempt count, and would retry a rate limit that
// must pause the run instead.
export const anthropicStructuredModel = ({ apiKey, modelId, maxOutputTokens }: AnthropicModelSettings, schema: z.ZodType): StructuredModel =>
  new ChatAnthropic({ apiKey, model: modelId, maxTokens: maxOutputTokens, maxRetries: 0, clientOptions: { maxRetries: 0 } }).withStructuredOutput(schema, {
    method: "jsonSchema",
    includeRaw: true,
  });

interface ProviderFailure {
  status?: number;
  name?: string;
  headers?: { get(name: string): string | null };
}

const PAUSING_STATUSES = new Set([429, 529]);
const REFUSED_KEY_STATUSES = new Set([401, 403]);
const TIMEOUT_NAMES = new Set(["TimeoutError", "AbortError", "APIConnectionTimeoutError"]);

function retryAfterOf(headers: ProviderFailure["headers"]): number | null {
  const header = headers?.get("retry-after");
  const seconds = header == null ? Number.NaN : Number(header);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

// Read by status and name only, never by message, so the Provider's words stay out of the error.
function failureOf(error: unknown): Error {
  const { status, name, headers } = (typeof error === "object" && error !== null ? error : {}) as ProviderFailure;

  if (status !== undefined && PAUSING_STATUSES.has(status)) {
    return new ProviderRateLimitedError(retryAfterOf(headers));
  }

  if (status !== undefined && REFUSED_KEY_STATUSES.has(status)) {
    return new ModelKeyRejectedError();
  }

  return new CurationCallFailedError(name !== undefined && TIMEOUT_NAMES.has(name) ? "timeout" : "provider_error");
}

const stopReasonOf = (raw: BaseMessage): unknown => (raw.response_metadata as { stop_reason?: unknown }).stop_reason;

const usageOf = (raw: BaseMessage): TokenUsage => {
  const usage = (raw as { usage_metadata?: { input_tokens: number; output_tokens: number } }).usage_metadata;

  return { inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 };
};

// One call, and either output that validated against the shared schema or one of the errors in
// curation-model-errors.ts: an answer is never repaired and never partly kept (docs/security.md).
export async function structuredAnswerOf<Output>(model: StructuredModel, { system, user }: ModelMessages, schema: z.ZodType<Output>): Promise<StructuredAnswer<Output>> {
  let answer: RawStructuredAnswer;

  try {
    answer = await model.invoke(
      [
        ["system", system],
        ["human", user],
      ],
      { signal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
    );
  } catch (error) {
    throw failureOf(error);
  }

  const usage = usageOf(answer.raw);

  if (stopReasonOf(answer.raw) === "max_tokens") {
    throw new CurationCallFailedError("truncated_response", usage);
  }

  const output = schema.safeParse(answer.parsed);

  if (!output.success) {
    throw new CurationCallFailedError("invalid_output", usage);
  }

  return { output: output.data, usage };
}
