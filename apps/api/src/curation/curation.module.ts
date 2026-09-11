import { Module } from "@nestjs/common";

import { QueueModule } from "../queue/queue.module";
import { BullMqCurationQueue } from "./bullmq-curation.queue";
import { CurationQueue } from "./curation-queue";
import { CurationStarter } from "./curation-starter";
import { CurationRepository } from "./curation.repository";

@Module({
  imports: [QueueModule],
  providers: [CurationRepository, CurationStarter, { provide: CurationQueue, useClass: BullMqCurationQueue }],
  exports: [CurationRepository, CurationStarter, CurationQueue],
})
export class CurationModule {}
