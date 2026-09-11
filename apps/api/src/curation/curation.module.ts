import { Module } from "@nestjs/common";

import { Clock, SystemClock } from "../common/clock";
import { QueueModule } from "../queue/queue.module";
import { BullMqCurationQueue } from "./bullmq-curation.queue";
import { CurationProgressRepository } from "./curation-progress.repository";
import { CurationProgressService } from "./curation-progress.service";
import { CurationQueue } from "./curation-queue";
import { CurationStarter } from "./curation-starter";
import { CurationController } from "./curation.controller";
import { CurationRepository } from "./curation.repository";
import { StatementRepository } from "./statement.repository";

@Module({
  imports: [QueueModule],
  controllers: [CurationController],
  providers: [
    CurationRepository,
    CurationStarter,
    StatementRepository,
    CurationProgressRepository,
    CurationProgressService,
    { provide: CurationQueue, useClass: BullMqCurationQueue },
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [CurationRepository, CurationStarter, StatementRepository, CurationQueue],
})
export class CurationModule {}
