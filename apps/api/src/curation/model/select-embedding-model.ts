import type { Environment } from "../../config/environment.schema";
import type { EmbeddingModel } from "./embedding-model";
import { FakeEmbeddingModel } from "./fake-embedding-model";
import { OpenAiEmbeddingModel } from "./openai-embedding-model";

export class MissingEmbeddingKeyError extends Error {
  constructor() {
    super("A production configuration needs the platform embedding key: set EMBEDDING_API_KEY");
    this.name = "MissingEmbeddingKeyError";
  }
}

// The embedding key is the platform's, so its presence is platform configuration (ADR-0023).
export function selectEmbeddingModel(environment: Pick<Environment, "NODE_ENV" | "EMBEDDING_API_KEY">): EmbeddingModel {
  if (environment.EMBEDDING_API_KEY !== null) {
    return OpenAiEmbeddingModel.withKey(environment.EMBEDDING_API_KEY);
  }

  if (environment.NODE_ENV === "production") {
    throw new MissingEmbeddingKeyError();
  }

  return new FakeEmbeddingModel();
}
