import { Module } from "@nestjs/common";

import { Clock, SystemClock } from "../common/clock";
import { CurationModule } from "../curation/curation.module";
import { ExtractionModule } from "../extraction/extraction.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { QueueModule } from "../queue/queue.module";
import { ResumesModule } from "../resumes/resumes.module";
import { StorageModule } from "../storage/storage.module";
import { BullMqReconciliationQueue } from "./bullmq-reconciliation.queue";
import { ReconciliationQueue } from "./reconciliation-queue";
import { RECONCILIATION_SETTINGS, reconciliationSettingsProvider } from "./reconciliation-settings";
import { ReconciliationJob } from "./reconciliation.job";

@Module({
  imports: [QueueModule, StorageModule, IngestionModule, ResumesModule, ExtractionModule, CurationModule],
  providers: [
    { provide: Clock, useClass: SystemClock },
    reconciliationSettingsProvider,
    { provide: ReconciliationQueue, useClass: BullMqReconciliationQueue },
    ReconciliationJob,
  ],
  exports: [ReconciliationJob, ReconciliationQueue, RECONCILIATION_SETTINGS, Clock],
})
export class ReconciliationModule {}
