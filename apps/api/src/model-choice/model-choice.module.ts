import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";
import { modelKeyEncryptionKeyOf } from "../config/model-key-encryption-key";
import { ModelChoiceController } from "./model-choice.controller";
import { ModelChoiceRepository } from "./model-choice.repository";
import { ModelChoiceService } from "./model-choice.service";
import { ModelKeyCipher } from "./model-key-cipher";
import { ModelKeyValidator } from "./model-key-validator";
import { selectModelKeyValidator } from "./select-model-key-validator";

@Module({
  controllers: [ModelChoiceController],
  providers: [
    ModelChoiceRepository,
    ModelChoiceService,
    {
      provide: ModelKeyCipher,
      inject: [ConfigService],
      useFactory: (environment: EnvironmentConfig) => new ModelKeyCipher(modelKeyEncryptionKeyOf(environment.get("MODEL_KEY_ENCRYPTION_KEY", { infer: true }))),
    },
    {
      provide: ModelKeyValidator,
      inject: [ConfigService],
      useFactory: (environment: EnvironmentConfig) =>
        selectModelKeyValidator({
          NODE_ENV: environment.get("NODE_ENV", { infer: true }),
          MODEL_ADAPTER: environment.get("MODEL_ADAPTER", { infer: true }),
        }),
    },
  ],
  exports: [ModelChoiceService],
})
export class ModelChoiceModule {}
