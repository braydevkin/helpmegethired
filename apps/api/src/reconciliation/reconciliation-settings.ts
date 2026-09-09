import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";

export interface ReconciliationSettings {
  intervalMs: number;
  silentUploadAgeMs: number;
  pendingExpiryMs: number;
  staleProcessingMs: number;
  orphanObjectAgeMs: number;
}

export const RECONCILIATION_SETTINGS = Symbol("RECONCILIATION_SETTINGS");

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const RECONCILIATION_INTERVAL_MS = 5 * MINUTE_MS;
export const SILENT_UPLOAD_AGE_MS = 2 * MINUTE_MS;
export const PENDING_EXPIRY_MS = 24 * HOUR_MS;
export const ORPHAN_OBJECT_AGE_MS = 7 * DAY_MS;

export const reconciliationSettingsProvider = {
  provide: RECONCILIATION_SETTINGS,
  useFactory: (config: EnvironmentConfig): ReconciliationSettings => ({
    intervalMs: RECONCILIATION_INTERVAL_MS,
    silentUploadAgeMs: SILENT_UPLOAD_AGE_MS,
    pendingExpiryMs: PENDING_EXPIRY_MS,
    staleProcessingMs: config.get("STALE_PROCESSING_MINUTES", { infer: true }) * MINUTE_MS,
    orphanObjectAgeMs: ORPHAN_OBJECT_AGE_MS,
  }),
  inject: [ConfigService],
};
