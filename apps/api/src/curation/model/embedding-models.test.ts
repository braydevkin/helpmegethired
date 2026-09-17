import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS, EmbeddingFailedError } from "./embedding-model";
import { FakeEmbeddingModel } from "./fake-embedding-model";
import { OpenAiEmbeddingModel, type DocumentEmbedder } from "./openai-embedding-model";

const texts = ["Runs the deployment platform for forty product teams.", "Cut the median pipeline from 22 to 9 minutes."];

describe("FakeEmbeddingModel", () => {
  it("gives every text a unit vector of 1536 dimensions", async () => {
    const vectors = await new FakeEmbeddingModel().embed(texts);

    expect(vectors).toHaveLength(2);
    for (const vector of vectors) {
      expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(Math.hypot(...vector)).toBeCloseTo(1, 10);
    }
  });

  it("lands the same text on the same point and two texts on different ones", async () => {
    const [first, second] = await new FakeEmbeddingModel().embed(texts);
    const [again] = await new FakeEmbeddingModel().embed([texts[0] ?? ""]);

    expect(again).toEqual(first);
    expect(second).not.toEqual(first);
  });
});

describe("OpenAiEmbeddingModel", () => {
  const embedderAnswering = (answer: () => Promise<number[][]>): DocumentEmbedder => ({ embedDocuments: answer });
  const vectorOfLength = (length: number): number[] => Array.from({ length }, () => 0.01);

  it("answers one 1536-dimension vector per text", async () => {
    const vectors = [vectorOfLength(EMBEDDING_DIMENSIONS), vectorOfLength(EMBEDDING_DIMENSIONS)];

    await expect(new OpenAiEmbeddingModel(embedderAnswering(() => Promise.resolve(vectors))).embed(texts)).resolves.toEqual(vectors);
  });

  it.each([
    ["a vector of another dimension", () => Promise.resolve([vectorOfLength(3), vectorOfLength(EMBEDDING_DIMENSIONS)])],
    ["fewer vectors than texts", () => Promise.resolve([vectorOfLength(EMBEDDING_DIMENSIONS)])],
    ["a Provider failure", () => Promise.reject(new Error("Incorrect API key provided: sk-proj-platform-key"))],
  ])("refuses %s with an error that carries nothing the Provider said", async (_label, answer) => {
    const failure = await new OpenAiEmbeddingModel(embedderAnswering(answer)).embed(texts).catch((error: unknown) => error);

    expect(failure).toEqual(new EmbeddingFailedError());
    expect((failure as Error).message).not.toContain("sk-proj");
  });
});
