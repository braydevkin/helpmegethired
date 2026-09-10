import { createHash } from "node:crypto";

import { EMBEDDING_DIMENSIONS, EmbeddingModel } from "./embedding-model";

const BYTE_MIDPOINT = 127.5;

// A unit vector drawn from the text's digest: the same text always lands on the same point and two
// texts almost never share one, so retrieval over fake embeddings is repeatable with no key.
function vectorOf(text: string): number[] {
  const values: number[] = [];

  for (let block = 0; values.length < EMBEDDING_DIMENSIONS; block += 1) {
    for (const byte of createHash("sha256").update(`${block}:${text}`).digest()) {
      values.push(byte / BYTE_MIDPOINT - 1);
    }
  }

  const vector = values.slice(0, EMBEDDING_DIMENSIONS);
  const length = Math.hypot(...vector);

  return vector.map((value) => value / length);
}

export class FakeEmbeddingModel extends EmbeddingModel {
  embed(texts: readonly string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(vectorOf));
  }
}
