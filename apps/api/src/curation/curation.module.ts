import { Module } from "@nestjs/common";

import { Clock, SystemClock } from "../common/clock";
import { QueueModule } from "../queue/queue.module";
import { BullMqCurationQueue } from "./bullmq-curation.queue";
import { CurationActions } from "./curation-actions";
import { CurationProgressRepository } from "./curation-progress.repository";
import { CurationProgressService } from "./curation-progress.service";
import { CurationQueue } from "./curation-queue";
import { CurationRunRepository } from "./curation-run.repository";
import { CurationStarter } from "./curation-starter";
import { CurationController } from "./curation.controller";
import { CurationRepository } from "./curation.repository";
import { RerunGate } from "./rerun-gate";
import { StatementReviewController } from "./statement-review.controller";
import { StatementReviewRepository } from "./statement-review.repository";
import { StatementReviewService } from "./statement-review.service";
import { StatementRepository } from "./statement.repository";

@Module({
  imports: [QueueModule],
  controllers: [CurationController, StatementReviewController],
  providers: [
    CurationRepository,
    CurationRunRepository,
    CurationStarter,
    StatementRepository,
    CurationProgressRepository,
    CurationProgressService,
    CurationActions,
    RerunGate,
    { provide: CurationQueue, useClass: BullMqCurationQueue },
    { provide: Clock, useClass: SystemClock },
    StatementReviewRepository,
    StatementReviewService,
  ],
  exports: [CurationRepository, CurationRunRepository, CurationStarter, StatementRepository, CurationQueue],
})
export class CurationModule {}
