import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SegmentRecognitionKind } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "../curation/model/curation-model-errors";
import { FAKE_RETRY_AFTER_SECONDS } from "../curation/model/fake-key-script";
import { ModelKey } from "../model-choice/model-key";
import { FakeRecognitionModel } from "./fake-recognition-model";
import { recognitionByRules } from "./recognition-by-rules";
import type { RecognitionCall } from "./recognition-model";

const experienceLines = ["Backend Engineer | Difference Works", "Manchester · Jun 2016 – Feb 2021", "Built the billing service in TypeScript on PostgreSQL."];

const callOf = <Kind extends SegmentRecognitionKind>(kind: Kind, lines: readonly string[], key = "sk-ant-development-key-000000"): RecognitionCall<Kind> => ({
  kind,
  lines,
  modelId: "claude-sonnet-5",
  modelKey: new ModelKey(key),
});

describe("FakeRecognitionModel", () => {
  it("answers what the rules read from the same lines, with the tokens a call that size would spend", async () => {
    const { output, usage } = await new FakeRecognitionModel().recognize(callOf("experience", experienceLines));

    expect(output).toEqual(recognitionByRules("experience", experienceLines));
    expect(output.experiences[0]?.company).toEqual({ value: "Difference Works", quote: "Difference Works" });
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  });

  it("gives the same answer and the same token counts for the same lines", async () => {
    const call = callOf("experience", experienceLines);

    expect(await new FakeRecognitionModel().recognize(call)).toEqual(await new FakeRecognitionModel().recognize(call));
  });

  it("answers the injection Resume like any other text, quoting only what it holds", async () => {
    const resume = readFileSync(join(__dirname, "../../test/fixtures/injection/resume.txt"), "utf8").split("\n");
    const { output } = await new FakeRecognitionModel().recognize(callOf("header", resume));

    expect(output.headline).toEqual({ value: "Senior Platform Engineer", quote: "Senior Platform Engineer" });
    expect(resume.join("\n")).toContain(output.summary?.quote);
  });

  it("plays its scripted outcomes in order, then answers", async () => {
    const model = new FakeRecognitionModel(["timeout", "truncated_response", "rate_limited", "key_rejected"]);
    const call = callOf("experience", experienceLines);

    await expect(model.recognize(call)).rejects.toMatchObject({ name: CurationCallFailedError.name, outcome: "timeout" });
    await expect(model.recognize(call)).rejects.toMatchObject({ name: CurationCallFailedError.name, outcome: "truncated_response" });
    await expect(model.recognize(call)).rejects.toEqual(new ProviderRateLimitedError(FAKE_RETRY_AFTER_SECONDS));
    await expect(model.recognize(call)).rejects.toBeInstanceOf(ModelKeyRejectedError);
    await expect(model.recognize(call)).resolves.toMatchObject({ output: { experiences: [expect.any(Object)] } });
  });

  describe("a key that scripts an outcome", () => {
    it("plays the outcome for the named kind of Segment, every time, and answers every other kind", async () => {
      const model = new FakeRecognitionModel();
      const key = "sk-ant-fake-invalid_output-on-experience";

      await expect(model.recognize(callOf("experience", experienceLines, key))).rejects.toMatchObject({ name: CurationCallFailedError.name, outcome: "invalid_output" });
      await expect(model.recognize(callOf("languages", ["English - Native"], key))).resolves.toMatchObject({ output: { languages: [expect.any(Object)] } });
      await expect(model.recognize(callOf("experience", experienceLines, key))).rejects.toMatchObject({ outcome: "invalid_output" });
    });

    it("pauses the named kind of Segment with a rate limit", async () => {
      await expect(new FakeRecognitionModel().recognize(callOf("languages", ["English - Native"], "sk-ant-fake-rate_limited-on-languages"))).rejects.toEqual(
        new ProviderRateLimitedError(FAKE_RETRY_AFTER_SECONDS),
      );
    });

    it.each(["sk-ant-fake-answer-on-experience", "sk-ant-fake-timeout-on-synthesis", "sk-ant-fake-timeout-on-experience-", "sk-ant-development-key-000000"])(
      "answers every Segment for %s, which scripts nothing it knows",
      async (key) => {
        await expect(new FakeRecognitionModel().recognize(callOf("experience", experienceLines, key))).resolves.toMatchObject({
          output: { experiences: [expect.any(Object)] },
        });
      },
    );

    it("plays its constructor's script before the key's", async () => {
      const model = new FakeRecognitionModel(["provider_error"]);
      const call = callOf("experience", experienceLines, "sk-ant-fake-timeout-on-experience");

      await expect(model.recognize(call)).rejects.toMatchObject({ outcome: "provider_error" });
      await expect(model.recognize(call)).rejects.toMatchObject({ outcome: "timeout" });
    });
  });
});
