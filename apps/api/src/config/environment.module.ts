import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import type { Environment } from "./environment.schema";
import { validateEnvironment } from "./validate-environment";

export type EnvironmentConfig = ConfigService<Environment, true>;

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
})
export class EnvironmentModule {}
