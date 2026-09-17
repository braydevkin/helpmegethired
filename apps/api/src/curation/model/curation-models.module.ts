import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../../config/environment.module";
import { CurationModel } from "./curation-model";
import { EmbeddingModel } from "./embedding-model";
import { selectCurationModel } from "./select-curation-model";
import { selectEmbeddingModel } from "./select-embedding-model";

@Module({
  providers: [
    {
      provide: CurationModel,
      inject: [ConfigService],
      useFactory: (environment: EnvironmentConfig) =>
        selectCurationModel({
          NODE_ENV: environment.get("NODE_ENV", { infer: true }),
          MODEL_ADAPTER: environment.get("MODEL_ADAPTER", { infer: true }),
        }),
    },
    {
      provide: EmbeddingModel,
      inject: [ConfigService],
      useFactory: (environment: EnvironmentConfig) =>
        selectEmbeddingModel({
          NODE_ENV: environment.get("NODE_ENV", { infer: true }),
          EMBEDDING_API_KEY: environment.get("EMBEDDING_API_KEY", { infer: true }),
        }),
    },
  ],
  exports: [CurationModel, EmbeddingModel],
})
export class CurationModelsModule {}
