import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";

export interface WorkerSettings {
  concurrency: number;
  lockDurationMs: number;
  stalledIntervalMs: number;
}

export const WORKER_SETTINGS = Symbol("WORKER_SETTINGS");

const LOCK_DURATION_MS = 30_000;
const STALLED_INTERVAL_MS = 30_000;

// Every consumer on the worker takes WORKER_CONCURRENCY jobs at a time under the same lock.
export const workerSettingsProvider = {
  provide: WORKER_SETTINGS,
  useFactory: (config: EnvironmentConfig): WorkerSettings => ({
    concurrency: config.get("WORKER_CONCURRENCY", { infer: true }),
    lockDurationMs: LOCK_DURATION_MS,
    stalledIntervalMs: STALLED_INTERVAL_MS,
  }),
  inject: [ConfigService],
};
