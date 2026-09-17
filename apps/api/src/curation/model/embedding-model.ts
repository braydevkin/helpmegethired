// The dimension of `statements.embedding` (ADR-0023); a vector of any other length is refused.
export const EMBEDDING_DIMENSIONS = 1536;

export abstract class EmbeddingModel {
  abstract embed(texts: readonly string[]): Promise<number[][]>;
}

export class EmbeddingFailedError extends Error {
  constructor() {
    super("The embedding model produced no usable vectors");
    this.name = "EmbeddingFailedError";
  }
}
