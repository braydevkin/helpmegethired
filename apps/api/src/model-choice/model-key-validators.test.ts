import { describe, expect, it, vi } from "vitest";

import { AnthropicModelKeyValidator } from "./anthropic-model-key-validator";
import { DEVELOPMENT_REFUSED_MODEL_KEY, DEVELOPMENT_UNAVAILABLE_MODEL_KEY, DevelopmentModelKeyValidator } from "./development-model-key-validator";
import { MissingModelAdapterError, selectModelKeyValidator } from "./select-model-key-validator";

const target = { provider: "anthropic", modelId: "claude-sonnet-5" } as const;
const modelKey = "sk-ant-api03-a-candidate-key-for-the-validator";

const answering = (status: number, body = '{"type":"error","error":{"message":"echoes sk-ant-api03"}}') =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));

describe("AnthropicModelKeyValidator", () => {
  it("retrieves the pinned model with the key and the API version, spending no tokens", async () => {
    const fetchModel = answering(200, "{}");

    await new AnthropicModelKeyValidator(fetchModel).validate(target, modelKey);

    const [url, init] = fetchModel.mock.calls[0] ?? [];

    expect(url).toBe("https://api.anthropic.com/v1/models/claude-sonnet-5");
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.headers).toEqual({ "x-api-key": modelKey, "anthropic-version": "2023-06-01" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [200, "valid"],
    [401, "invalid"],
    [403, "not_permitted"],
    [404, "not_permitted"],
    [429, "unavailable"],
    [500, "unavailable"],
    [529, "unavailable"],
  ])("reads %i as %s", async (status, verdict) => {
    await expect(new AnthropicModelKeyValidator(answering(status)).validate(target, modelKey)).resolves.toBe(verdict);
  });

  it("reads a network failure or a timeout as the Provider being unavailable, never as an invalid key", async () => {
    const failing = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));

    await expect(new AnthropicModelKeyValidator(failing).validate(target, modelKey)).resolves.toBe("unavailable");
  });
});

describe("DevelopmentModelKeyValidator", () => {
  const validator = new DevelopmentModelKeyValidator();

  it("accepts any key but the two documented ones", async () => {
    await expect(validator.validate(target, modelKey)).resolves.toBe("valid");
    await expect(validator.validate(target, DEVELOPMENT_REFUSED_MODEL_KEY)).resolves.toBe("invalid");
    await expect(validator.validate(target, DEVELOPMENT_UNAVAILABLE_MODEL_KEY)).resolves.toBe("unavailable");
  });
});

describe("selectModelKeyValidator", () => {
  it("selects the Anthropic validator when the platform names it", () => {
    expect(selectModelKeyValidator({ NODE_ENV: "production", MODEL_ADAPTER: "anthropic" })).toBeInstanceOf(AnthropicModelKeyValidator);
    expect(selectModelKeyValidator({ NODE_ENV: "development", MODEL_ADAPTER: "anthropic" })).toBeInstanceOf(AnthropicModelKeyValidator);
  });

  it("selects the development validator outside production when none is named", () => {
    expect(selectModelKeyValidator({ NODE_ENV: "test", MODEL_ADAPTER: undefined })).toBeInstanceOf(DevelopmentModelKeyValidator);
  });

  it("refuses to start in production with no adapter named", () => {
    expect(() => selectModelKeyValidator({ NODE_ENV: "production", MODEL_ADAPTER: undefined })).toThrow(MissingModelAdapterError);
  });
});
