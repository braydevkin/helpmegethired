import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";
import { RecognitionModel } from "./recognition-model";
import { selectRecognitionModel } from "./select-recognition-model";

@Module({
  providers: [
    {
      provide: RecognitionModel,
      inject: [ConfigService],
      useFactory: (environment: EnvironmentConfig) =>
        selectRecognitionModel({
          NODE_ENV: environment.get("NODE_ENV", { infer: true }),
          MODEL_ADAPTER: environment.get("MODEL_ADAPTER", { infer: true }),
        }),
    },
  ],
  exports: [RecognitionModel],
})
export class RecognitionModelsModule {}
