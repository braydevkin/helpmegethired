import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Id } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import { UploadedResumeRunRepository, type ExtractionRecord } from "../extraction/uploaded-resume-run.repository";
import { IngestionQueue } from "../ingestion/ingestion-queue";
import { IngestionRunRepository } from "../ingestion/ingestion-run.repository";
import { RESUME_OBJECT_PREFIX } from "../resumes/resume-object-key";
import { ResumeExtractionQueue } from "../resumes/resume-extraction-queue";
import { ObjectStorage, type ListedObject } from "../storage/object-storage";
import { RECONCILIATION_SETTINGS, type ReconciliationSettings } from "./reconciliation-settings";

export interface ReconciliationReport {
  promoted: number;
  expired: number;
  reEnqueued: number;
  reset: number;
  failed: number;
  ingestionsReEnqueued: number;
  ingestionsFailed: number;
  objectsDeleted: number;
}

// Keys are looked up in batches well under PostgreSQL's parameter limit, whatever the page size.
const SWEEP_BATCH_SIZE = 500;
const STALE_RUN_MESSAGE = "No active job while processing";
const STALE_INGESTION_MESSAGE = "No active job while queued or running";
const SWEPT_OBJECT_STATUSES = new Set(["expired", "failed"]);

const emptyReport = (): ReconciliationReport => ({
  promoted: 0,
  expired: 0,
  reEnqueued: 0,
  reset: 0,
  failed: 0,
  ingestionsReEnqueued: 0,
  ingestionsFailed: 0,
  objectsDeleted: 0,
});

// Makes the upload state machine converge without a transactional enqueue: it promotes
// uploads that finished silently, expires abandoned ones, re-enqueues rows without a job,
// resets or fails stale runs, and sweeps the bucket. Every action is one log line naming
// ids only, never Candidate data.
@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    private readonly clock: Clock,
    @Inject(RECONCILIATION_SETTINGS) private readonly settings: ReconciliationSettings,
    private readonly resumes: UploadedResumeRunRepository,
    private readonly ingestions: IngestionRunRepository,
    private readonly storage: ObjectStorage,
    private readonly extractionQueue: ResumeExtractionQueue,
    private readonly ingestionQueue: IngestionQueue,
  ) {}

  async run(): Promise<ReconciliationReport> {
    const report = emptyReport();
    const now = this.clock.now().getTime();

    await this.settlePendingUploads(now, report);
    await this.reEnqueueOrphans(report);
    await this.settleStaleExtractions(now, report);
    await this.settleStaleIngestions(now, report);
    await this.sweepBucket(now, report);

    this.logger.log(`reconciliation run ${describe(report)}`);

    return report;
  }

  private async settlePendingUploads(now: number, report: ReconciliationReport): Promise<void> {
    const expiryCutoff = now - this.settings.pendingExpiryMs;

    for (const record of await this.resumes.findPendingCreatedBefore(new Date(now - this.settings.silentUploadAgeMs))) {
      await this.guarded("uploaded_resume", record.id, async () => {
        const object = await this.storage.head(record.objectKey);

        if (object?.size === record.sizeBytes) {
          if (await this.resumes.promote(record.id)) {
            await this.enqueueExtraction(record);
            this.act("promote", "uploaded_resume", record.id);
            report.promoted += 1;
          }
        } else if (!object && record.createdAt.getTime() < expiryCutoff && (await this.resumes.expire(record.id))) {
          this.act("expire", "uploaded_resume", record.id);
          report.expired += 1;
        }
      });
    }
  }

  private async reEnqueueOrphans(report: ReconciliationReport): Promise<void> {
    for (const record of await this.resumes.findUploaded()) {
      await this.guarded("uploaded_resume", record.id, async () => {
        if (!(await this.extractionQueue.hasPendingJob(record.id))) {
          await this.enqueueExtraction(record);
          this.act("re-enqueue", "uploaded_resume", record.id);
          report.reEnqueued += 1;
        }
      });
    }
  }

  private async settleStaleExtractions(now: number, report: ReconciliationReport): Promise<void> {
    const cutoff = new Date(now - this.settings.staleProcessingMs);

    for (const record of await this.resumes.findProcessingWithoutIngestionUpdatedBefore(cutoff)) {
      await this.guarded("uploaded_resume", record.id, async () => {
        if (await this.extractionQueue.hasPendingJob(record.id)) {
          return;
        }

        const settled = await this.resumes.settleStale(record.id, STALE_RUN_MESSAGE);

        if (settled?.status === "uploaded") {
          await this.enqueueExtraction(settled);
          this.act("reset", "uploaded_resume", record.id);
          report.reset += 1;
        } else if (settled?.status === "failed") {
          await this.deleteObject(settled);
          this.act("fail", "uploaded_resume", record.id);
          report.failed += 1;
        }
      });
    }
  }

  private async settleStaleIngestions(now: number, report: ReconciliationReport): Promise<void> {
    const cutoff = new Date(now - this.settings.staleProcessingMs);

    for (const ingestion of await this.ingestions.findActiveUpdatedBefore(cutoff)) {
      await this.guarded("ingestion", ingestion.id, async () => {
        if (await this.ingestionQueue.hasPendingJob(ingestion.id)) {
          return;
        }

        const settled = await this.ingestions.settleStale(ingestion.id, STALE_INGESTION_MESSAGE);

        if (settled?.status === "queued") {
          await this.ingestionQueue.enqueue({ ingestionId: settled.id, maxAttempts: settled.maxAttempts });
          this.act("re-enqueue", "ingestion", ingestion.id);
          report.ingestionsReEnqueued += 1;
        } else if (settled?.status === "failed") {
          for (const record of await this.resumes.failByIngestion(ingestion.id, "profile_build_failed", STALE_INGESTION_MESSAGE)) {
            await this.deleteObject(record);
            this.act("fail", "uploaded_resume", record.id);
          }

          this.act("fail", "ingestion", ingestion.id);
          report.ingestionsFailed += 1;
        }
      });
    }
  }

  private async sweepBucket(now: number, report: ReconciliationReport): Promise<void> {
    const cutoff = now - this.settings.orphanObjectAgeMs;
    let aged: ListedObject[] = [];

    for await (const page of this.storage.list(RESUME_OBJECT_PREFIX)) {
      aged.push(...page.filter((object) => object.lastModified.getTime() < cutoff));

      while (aged.length >= SWEEP_BATCH_SIZE) {
        await this.sweepObjects(aged.slice(0, SWEEP_BATCH_SIZE), report);
        aged = aged.slice(SWEEP_BATCH_SIZE);
      }
    }

    await this.sweepObjects(aged, report);
  }

  private async sweepObjects(aged: readonly ListedObject[], report: ReconciliationReport): Promise<void> {
    const statuses = await this.resumes.statusesByObjectKey(aged.map((object) => object.key));

    for (const object of aged) {
      const status = statuses.get(object.key);

      if (status === undefined || SWEPT_OBJECT_STATUSES.has(status)) {
        await this.guarded("object", object.key, async () => {
          await this.storage.delete(object.key);
          this.act("delete", "object", object.key);
          report.objectsDeleted += 1;
        });
      }
    }
  }

  private enqueueExtraction(record: ExtractionRecord): Promise<void> {
    return this.extractionQueue.enqueue({ uploadedResumeId: record.id, maxAttempts: record.maxAttempts });
  }

  private async deleteObject(record: ExtractionRecord): Promise<void> {
    try {
      await this.storage.delete(record.objectKey);
    } catch (error) {
      this.logger.error(`reconciliation object of uploaded_resume=${record.id} could not be deleted`, error);
    }
  }

  // One row that cannot be settled must not stop the others; the next run looks at it again.
  private async guarded(subject: string, id: Id | string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.logger.error(`reconciliation ${subject}=${id} could not be settled`, error);
    }
  }

  private act(action: string, subject: string, id: Id | string): void {
    this.logger.log(`reconciliation action=${action} ${subject}=${id}`);
  }
}

const describe = (report: ReconciliationReport): string =>
  Object.entries(report)
    .map(([name, count]) => `${name}=${count}`)
    .join(" ");
