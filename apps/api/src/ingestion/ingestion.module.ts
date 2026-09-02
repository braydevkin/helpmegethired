import { Module } from "@nestjs/common";

import { QueueModule } from "../queue/queue.module";
import { IngestionQueue } from "./ingestion-queue";
import { IngestionRepository } from "./ingestion.repository";
import { IngestionRunner } from "./ingestion.runner";
import { IngestionService } from "./ingestion.service";
import { IngestionWorker } from "./ingestion.worker";
import { PgBossIngestionQueue } from "./pg-boss-ingestion.queue";
import { SEGMENT_PROCESSORS } from "./segment-processor";
import { SegmentProcessorRegistry } from "./segment-processor.registry";

@Module({
  imports: [QueueModule],
  providers: [
    IngestionRepository,
    IngestionRunner,
    IngestionService,
    IngestionWorker,
    SegmentProcessorRegistry,
    { provide: SEGMENT_PROCESSORS, useValue: [] },
    { provide: IngestionQueue, useClass: PgBossIngestionQueue },
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
