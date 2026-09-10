import { ModelKeyValidator, type ModelKeyTarget, type ModelKeyVerdict } from "./model-key-validator";

const MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_VERSION = "2023-06-01";
export const VALIDATION_TIMEOUT_MS = 10_000;

const verdictOf = (status: number): ModelKeyVerdict => {
  if (status >= 200 && status < 300) {
    return "valid";
  }

  if (status === 401) {
    return "invalid";
  }

  return status === 403 || status === 404 ? "not_permitted" : "unavailable";
};

// Retrieving the pinned model spends no tokens and proves both that the key is live and that its
// organisation may use the model. The answer's body is never read, so nothing the Provider says
// can reach a log line or a response.
export class AnthropicModelKeyValidator extends ModelKeyValidator {
  constructor(private readonly fetchModel: typeof fetch = fetch) {
    super();
  }

  async validate({ modelId }: ModelKeyTarget, modelKey: string): Promise<ModelKeyVerdict> {
    try {
      const response = await this.fetchModel(`${MODELS_URL}/${encodeURIComponent(modelId)}`, {
        method: "GET",
        headers: { "x-api-key": modelKey, "anthropic-version": ANTHROPIC_VERSION },
        signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
      });

      await response.body?.cancel();

      return verdictOf(response.status);
    } catch {
      return "unavailable";
    }
  }
}
