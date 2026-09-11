import { Module } from "@nestjs/common";

import { QueueModule } from "../queue/queue.module";
import { BullMqCurationQueue } from "./bullmq-curation.queue";
import { CurationQueue } from "./curation-queue";
import { CurationStarter } from "./curation-starter";
import { CurationRepository } from "./curation.repository";
import { StatementRepository } from "./statement.repository";

@Module({
  imports: [QueueModule],
  providers: [CurationRepository, CurationStarter, StatementRepository, { provide: CurationQueue, useClass: BullMqCurationQueue }],
  exports: [CurationRepository, CurationStarter, StatementRepository, CurationQueue],
})
export class CurationModule {}
