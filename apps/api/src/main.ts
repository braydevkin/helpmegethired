import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import type { EnvironmentConfig } from "./config/environment.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const environment = app.get<EnvironmentConfig>(ConfigService);

  app.enableCors({ origin: environment.get("WEB_ORIGIN", { infer: true }) });

  await app.listen(environment.get("PORT", { infer: true }));
  Logger.log(`Listening on ${await app.getUrl()}`, "Bootstrap");
}

void bootstrap();
