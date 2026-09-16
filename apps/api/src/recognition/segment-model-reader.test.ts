import type { SegmentRecognitionKind } from "@helpmegethired/shared";
import { describe, expect, it, vi } from "vitest";

import { ModelKeyRejectedError } from "../curation/model/curation-model-errors";
import { ModelKeyNotFoundError } from "../model-choice/model-choice-errors";
import type { ModelChoiceService } from "../model-choice/model-choice.service";
import { ModelKey, type UsableModelKey } from "../model-choice/model-key";
import { RecognitionModel, type RecognitionAnswer, type RecognitionCall } from "./recognition-model";
import { SegmentModelReader } from "./segment-model-reader";

const ACCOUNT_ID = "7d3f1c2a-9b8e-4c6d-a5f4-3e2d1c0b9a87";
const LINES = ["English - Native"];
const ANSWER = { languages: [{ name: { value: "English", quote: "English" }, level: { value: "Native", quote: "Native" } }] };

class StubRecognitionModel extends RecognitionModel {
  readonly calls: RecognitionCall<SegmentRecognitionKind>[] = [];

  constructor(private readonly answer: () => Promise<RecognitionAnswer<"languages">>) {
    super();
  }

  recognize<Kind extends SegmentRecognitionKind>(call: RecognitionCall<Kind>): Promise<RecognitionAnswer<Kind>> {
    this.calls.push(call);

    return this.answer() as Promise<RecognitionAnswer<Kind>>;
  }
}

const choicesAnswering = (usableModelKey: () => Promise<UsableModelKey>) => ({ usableModelKey }) as unknown as ModelChoiceService;

const keyOf = (): Promise<UsableModelKey> => Promise.resolve({ provider: "anthropic", modelId: "claude-sonnet-5", key: new ModelKey("sk-ant-candidate") });

describe("SegmentModelReader", () => {
  it("reads nothing and calls no Model for an Account without a Model Key", async () => {
    const model = new StubRecognitionModel(() => Promise.resolve({ output: ANSWER, usage: { inputTokens: 1, outputTokens: 1 } }));
    const reader = new SegmentModelReader(
      choicesAnswering(() => Promise.reject(new ModelKeyNotFoundError(ACCOUNT_ID))),
      model,
    );

    await expect(reader.read({ accountId: ACCOUNT_ID, kind: "languages", lines: LINES })).resolves.toBeNull();
    expect(model.calls).toEqual([]);
  });

  it("asks the Model for the Segment's kind and lines on the Account's Model and key, and answers its output", async () => {
    const model = new StubRecognitionModel(() => Promise.resolve({ output: ANSWER, usage: { inputTokens: 120, outputTokens: 40 } }));
    const reader = new SegmentModelReader(choicesAnswering(keyOf), model);

    await expect(reader.read({ accountId: ACCOUNT_ID, kind: "languages", lines: LINES })).resolves.toEqual(ANSWER);
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]).toMatchObject({ kind: "languages", lines: LINES, modelId: "claude-sonnet-5" });
    expect(model.calls[0]?.modelKey.reveal()).toBe("sk-ant-candidate");
  });

  it("throws what the Model throws, so the Ingestion's attempts apply", async () => {
    const model = new StubRecognitionModel(() => Promise.reject(new ModelKeyRejectedError()));
    const reader = new SegmentModelReader(choicesAnswering(keyOf), model);

    await expect(reader.read({ accountId: ACCOUNT_ID, kind: "languages", lines: LINES })).rejects.toBeInstanceOf(ModelKeyRejectedError);
  });

  it("throws a failure to open the key other than a missing one", async () => {
    const opening = vi.fn(() => Promise.reject(new Error("The sealed key does not open")));
    const model = new StubRecognitionModel(() => Promise.resolve({ output: ANSWER, usage: { inputTokens: 1, outputTokens: 1 } }));
    const reader = new SegmentModelReader(choicesAnswering(opening), model);

    await expect(reader.read({ accountId: ACCOUNT_ID, kind: "languages", lines: LINES })).rejects.toThrow("The sealed key does not open");
    expect(model.calls).toEqual([]);
  });
});
