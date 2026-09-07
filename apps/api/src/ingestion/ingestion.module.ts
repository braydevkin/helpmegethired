import { Module } from "@nestjs/common";

import { QueueModule } from "../queue/queue.module";
import { BullMqIngestionQueue } from "./bullmq-ingestion.queue";
import { IngestionQueue } from "./ingestion-queue";
import { IngestionRunRepository } from "./ingestion-run.repository";
import { ingestionWorkerSettingsProvider } from "./ingestion-worker-settings";
import { IngestionRepository } from "./ingestion.repository";
import { IngestionRunner } from "./ingestion.runner";
import { IngestionService } from "./ingestion.service";
import { SEGMENT_PROCESSORS } from "./segment-processor";
import { SegmentProcessorRegistry } from "./segment-processor.registry";

@Module({
  imports: [QueueModule],
  providers: [
    IngestionRepository,
    IngestionRunRepository,
    IngestionRunner,
    IngestionService,
    SegmentProcessorRegistry,
    ingestionWorkerSettingsProvider,
    { provide: SEGMENT_PROCESSORS, useValue: [] },
    { provide: IngestionQueue, useClass: BullMqIngestionQueue },
  ],
  exports: [IngestionService, IngestionRepository, IngestionRunner, IngestionQueue],
})
export class IngestionModule {}
