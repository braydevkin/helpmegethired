import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";

export interface IngestionWorkerSettings {
  concurrency: number;
  lockDurationMs: number;
  stalledIntervalMs: number;
}

export const INGESTION_WORKER_SETTINGS = Symbol("INGESTION_WORKER_SETTINGS");

const LOCK_DURATION_MS = 30_000;
const STALLED_INTERVAL_MS = 30_000;

export const ingestionWorkerSettingsProvider = {
  provide: INGESTION_WORKER_SETTINGS,
  useFactory: (config: EnvironmentConfig): IngestionWorkerSettings => ({
    concurrency: config.get("WORKER_CONCURRENCY", { infer: true }),
    lockDurationMs: LOCK_DURATION_MS,
    stalledIntervalMs: STALLED_INTERVAL_MS,
  }),
  inject: [ConfigService],
};
