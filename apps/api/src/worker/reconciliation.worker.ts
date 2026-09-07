import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { ReconciliationQueue } from "../reconciliation/reconciliation-queue";
import { RECONCILIATION_SETTINGS, type ReconciliationSettings } from "../reconciliation/reconciliation-settings";
import { ReconciliationJob } from "../reconciliation/reconciliation.job";

@Injectable()
export class ReconciliationWorker implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationWorker.name);

  constructor(
    private readonly queue: ReconciliationQueue,
    private readonly job: ReconciliationJob,
    @Inject(RECONCILIATION_SETTINGS) private readonly settings: ReconciliationSettings,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work(async () => {
      await this.job.run();
    });
    await this.queue.schedule(this.settings.intervalMs);
    this.logger.log(`Reconciling every ${this.settings.intervalMs} ms`);
  }
}
