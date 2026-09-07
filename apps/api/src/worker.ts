import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import type { EnvironmentConfig } from "./config/environment.module";
import { WorkerModule } from "./worker/worker.module";

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(WorkerModule);
  const environment = context.get<EnvironmentConfig>(ConfigService);

  context.enableShutdownHooks();
  Logger.log(`Consuming with a concurrency of ${environment.get("WORKER_CONCURRENCY", { infer: true })}`, "Worker");
}

void bootstrap();
