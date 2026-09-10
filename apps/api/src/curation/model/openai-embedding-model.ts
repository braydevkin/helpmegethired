import { OpenAIEmbeddings } from "@langchain/openai";

import { EMBEDDING_DIMENSIONS, EmbeddingFailedError, EmbeddingModel } from "./embedding-model";

export const EMBEDDING_MODEL = "text-embedding-3-small";

export interface DocumentEmbedder {
  embedDocuments(texts: string[]): Promise<number[][]>;
}

// The platform's own key and the platform's only AI spend (ADR-0023). A failure is a failure of
// the Curation, so it is left to the queue's attempts rather than retried here.
export class OpenAiEmbeddingModel extends EmbeddingModel {
  constructor(private readonly embedder: DocumentEmbedder) {
    super();
  }

  static withKey(apiKey: string): OpenAiEmbeddingModel {
    return new OpenAiEmbeddingModel(new OpenAIEmbeddings({ apiKey, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, maxRetries: 0 }));
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    let vectors: number[][];

    try {
      vectors = await this.embedder.embedDocuments([...texts]);
    } catch {
      throw new EmbeddingFailedError();
    }

    if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw new EmbeddingFailedError();
    }

    return vectors;
  }
}
