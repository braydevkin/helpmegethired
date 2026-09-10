import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseMessage } from "@langchain/core/messages";
import { CurationUnitOutputSchema, type ModelId } from "@helpmegethired/shared";

import { CurationModel, type CurationAnswer, type CurationCall, type TokenUsage } from "./curation-model";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "./curation-model-errors";
import { curationMessagesOf } from "./curation-prompt";

export const MAX_OUTPUT_TOKENS = 8192;
export const CALL_TIMEOUT_MS = 120_000;

export interface RawStructuredAnswer {
  raw: BaseMessage;
  parsed: unknown;
}

export interface StructuredCurationModel {
  invoke(messages: [role: "system" | "human", content: string][], options: { signal: AbortSignal }): Promise<RawStructuredAnswer>;
}

export type StructuredModelFactory = (apiKey: string, modelId: ModelId) => StructuredCurationModel;

// Retries belong to the queue, which counts attempts and backs off. A retry inside the adapter
// would spend the Candidate's tokens behind the attempt count, and would retry a rate limit that
// must pause the Curation instead.
const anthropicStructuredModel: StructuredModelFactory = (apiKey, modelId) =>
  new ChatAnthropic({ apiKey, model: modelId, maxTokens: MAX_OUTPUT_TOKENS, maxRetries: 0, clientOptions: { maxRetries: 0 } }).withStructuredOutput(
    CurationUnitOutputSchema,
    { method: "jsonSchema", includeRaw: true },
  );

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

export class AnthropicCurationModel extends CurationModel {
  constructor(private readonly structuredModelOf: StructuredModelFactory = anthropicStructuredModel) {
    super();
  }

  async generate({ prompt, modelId, modelKey }: CurationCall): Promise<CurationAnswer> {
    const { system, user } = curationMessagesOf(prompt);
    const model = this.structuredModelOf(modelKey.reveal(), modelId);
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

    const output = CurationUnitOutputSchema.safeParse(answer.parsed);

    if (!output.success) {
      throw new CurationCallFailedError("invalid_output", usage);
    }

    return { output: output.data, usage };
  }
}
