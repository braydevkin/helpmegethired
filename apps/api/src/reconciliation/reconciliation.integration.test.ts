import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { INestApplicationContext, ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDF_CONTENT_TYPE, type Id } from "@helpmegethired/shared";
import type { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Clock } from "../common/clock";
import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import type { IngestionRow, UploadedResumeRow } from "../database/database.schema";
import { createAccountPair } from "../database/testing/account-pair";
import { TransactionRunner } from "../database/transaction-runner";
import { ExtractionModule } from "../extraction/extraction.module";
import { UploadedResumeRunRepository } from "../extraction/uploaded-resume-run.repository";
import { IngestionRunRepository } from "../ingestion/ingestion-run.repository";
import { IngestionModule } from "../ingestion/ingestion.module";
import { IngestionRepository } from "../ingestion/ingestion.repository";
import { MAX_ATTEMPTS } from "../ingestion/ingestion.service";
import { PROFILE_INGESTION_QUEUE, QUEUE_PREFIX, RECONCILIATION_QUEUE, RESUME_EXTRACTION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS } from "../queue/worker-settings";
import { RESUME_OBJECT_PREFIX, resumeObjectKeyFor } from "../resumes/resume-object-key";
import { ResumesModule } from "../resumes/resumes.module";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { EXTRACTION_MAX_ATTEMPTS } from "../resumes/uploaded-resume.service";
import { ObjectStorage } from "../storage/object-storage";
import { StorageModule } from "../storage/storage.module";
import { WorkerModule } from "../worker/worker.module";
import {
  ORPHAN_OBJECT_AGE_MS,
  PENDING_EXPIRY_MS,
  RECONCILIATION_SETTINGS,
  SILENT_UPLOAD_AGE_MS,
  type ReconciliationSettings,
} from "./reconciliation-settings";
import { ReconciliationJob } from "./reconciliation.job";
import { ReconciliationModule } from "./reconciliation.module";

const SETTLE_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;
const MINUTE_MS = 60_000;
const STALE_MS = 10 * MINUTE_MS;

class FakeClock extends Clock {
  private current = Date.now();

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current += ms;
  }

  reset(): void {
    this.current = Date.now();
  }
}

const settings: ReconciliationSettings = {
  intervalMs: 1_000,
  silentUploadAgeMs: SILENT_UPLOAD_AGE_MS,
  pendingExpiryMs: PENDING_EXPIRY_MS,
  staleProcessingMs: STALE_MS,
  orphanObjectAgeMs: ORPHAN_OBJECT_AGE_MS,
};

const pdfBytes = () => Buffer.from(`%PDF-1.7\n% ${randomUUID()}\n%%EOF\n`);
const textResume = () => readFileSync(join(__dirname, "../../test/fixtures/resumes/hostile/embedded-javascript.pdf"));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;

  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the queue");
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

describe("reconciliation", () => {
  const prefix = `test-${randomUUID()}`;
  const clock = new FakeClock();
  const consumers: INestApplicationContext[] = [];
  let producer: INestApplicationContext;
  let database: Database;
  let storage: ObjectStorage;
  let uploads: UploadedResumeRepository;
  let runs: UploadedResumeRunRepository;
  let ingestionRuns: IngestionRunRepository;
  let job: ReconciliationJob;
  let extractionQueue: Queue;
  let ingestionQueue: Queue;

  const build = async (imports: ModuleMetadata["imports"], runOverride?: { run: () => Promise<void> }) => {
    const builder = Test.createTestingModule({ imports })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(prefix)
      .overrideProvider(WORKER_SETTINGS)
      .useValue({ concurrency: 1, lockDurationMs: 5_000, stalledIntervalMs: 5_000 })
      .overrideProvider(RECONCILIATION_SETTINGS)
      .useValue(settings)
      .overrideProvider(Clock)
      .useValue(clock);

    if (runOverride) {
      builder.overrideProvider(ReconciliationJob).useValue(runOverride);
    }

    return (await builder.compile()).init();
  };

  const rowOf = (id: Id): Promise<UploadedResumeRow> =>
    database.selectFrom("uploaded_resumes").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const ingestionRowOf = (id: Id): Promise<IngestionRow> =>
    database.selectFrom("ingestions").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const backdate = (table: "uploaded_resumes" | "ingestions", id: Id, ms: number) =>
    database
      .updateTable(table)
      .set({ created_at: new Date(Date.now() - ms), updated_at: new Date(Date.now() - ms) })
      .where("id", "=", id)
      .execute();

  const pendingRecord = async (bytes = pdfBytes()): Promise<UploadedResumeRow> => {
    const { owner } = await createAccountPair(database);
    const id = randomUUID();

    await uploads.create(owner, {
      id,
      fileName: "candidate.pdf",
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      objectKey: resumeObjectKeyFor(owner, id),
      maxAttempts: EXTRACTION_MAX_ATTEMPTS,
    });

    return rowOf(id);
  };

  const putObject = async (key: string, bytes: Buffer): Promise<void> => {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const presigned = await storage.presignPut(key, bytes.length, sha256, PDF_CONTENT_TYPE);
    const response = await fetch(presigned.url, { method: "PUT", headers: presigned.headers, body: bytes });

    expect(response.ok).toBe(true);
  };

  const uploadedRecord = async (): Promise<UploadedResumeRow> => {
    const bytes = pdfBytes();
    const record = await pendingRecord(bytes);

    await putObject(record.object_key, bytes);
    await uploads.markUploaded(record.account_id, record.id);

    return rowOf(record.id);
  };

  const processingRecord = async (attempts: number): Promise<UploadedResumeRow> => {
    const record = await uploadedRecord();

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await runs.beginAttempt(record.id);
    }

    return rowOf(record.id);
  };

  const queuedIngestion = async (accountId: Id): Promise<IngestionRow> => {
    const ingestion = await producer
      .get(TransactionRunner)
      .run((transaction) =>
        producer.get(IngestionRepository).create(accountId, "upload", [{ kind: "experience", input: { text: "first" } }], MAX_ATTEMPTS, transaction),
      );

    return ingestionRowOf(ingestion.id);
  };

  beforeAll(async () => {
    producer = await build([
      EnvironmentModule,
      DatabaseModule,
      StorageModule,
      IngestionModule,
      ResumesModule,
      ExtractionModule,
      ReconciliationModule,
    ]);
    database = producer.get(DATABASE);
    storage = producer.get(ObjectStorage);
    uploads = producer.get(UploadedResumeRepository);
    runs = producer.get(UploadedResumeRunRepository);
    ingestionRuns = producer.get(IngestionRunRepository);
    job = producer.get(ReconciliationJob);
    extractionQueue = producer.get<Queue>(RESUME_EXTRACTION_QUEUE);
    ingestionQueue = producer.get<Queue>(PROFILE_INGESTION_QUEUE);
  });

  afterEach(async () => {
    await Promise.all(consumers.splice(0).map((consumer) => consumer.close()));
    clock.reset();
  });

  afterAll(async () => {
    for await (const page of storage.list(RESUME_OBJECT_PREFIX)) {
      await Promise.all(page.map((object) => storage.delete(object.key)));
    }

    await Promise.all([extractionQueue, ingestionQueue, producer.get<Queue>(RECONCILIATION_QUEUE)].map((queue) => queue.obliterate({ force: true })));
    await producer.close();
  });

  it("promotes a PUT that finished without complete and the worker takes it to done", async () => {
    const bytes = textResume();
    const record = await pendingRecord(bytes);
    await putObject(record.object_key, bytes);
    await backdate("uploaded_resumes", record.id, 3 * MINUTE_MS);
    consumers.push(await build([WorkerModule]));

    // The consumer schedules its own runs, so whichever run promotes first is the right outcome.
    await job.run();

    await until(async () => ["done", "failed"].includes((await rowOf(record.id)).status));
    expect(await rowOf(record.id)).toMatchObject({ status: "done", error_code: null });
    expect(await storage.head(record.object_key)).toBeUndefined();
  });

  it("leaves a fresh pending record and one whose object has another size alone", async () => {
    const fresh = await pendingRecord();
    const wrongSize = await pendingRecord();
    await putObject(wrongSize.object_key, Buffer.from("%PDF-1.7\n% other bytes\n"));
    await backdate("uploaded_resumes", wrongSize.id, 3 * MINUTE_MS);

    await job.run();

    expect((await rowOf(fresh.id)).status).toBe("pending");
    expect((await rowOf(wrongSize.id)).status).toBe("pending");
  });

  it("expires a record pending for a day with no object", async () => {
    const record = await pendingRecord();
    await backdate("uploaded_resumes", record.id, PENDING_EXPIRY_MS + MINUTE_MS);

    const report = await job.run();

    expect(report.expired).toBeGreaterThanOrEqual(1);
    expect(await rowOf(record.id)).toMatchObject({ status: "expired" });
    expect((await rowOf(record.id)).finished_at).toBeInstanceOf(Date);
  });

  it("re-enqueues an uploaded record that has no job, and only once", async () => {
    const record = await uploadedRecord();

    expect(await extractionQueue.getJob(record.id)).toBeUndefined();

    const first = await job.run();
    const second = await job.run();

    expect(first.reEnqueued).toBeGreaterThanOrEqual(1);
    expect(second.reEnqueued).toBe(0);
    expect(await extractionQueue.getJob(record.id)).toMatchObject({ data: { uploadedResumeId: record.id, maxAttempts: EXTRACTION_MAX_ATTEMPTS } });
  });

  it("resets a stale processing record whose worker died, re-enqueues it once, and never duplicates it on the next run", async () => {
    const record = await processingRecord(1);
    await backdate("uploaded_resumes", record.id, STALE_MS + MINUTE_MS);

    const first = await job.run();
    const second = await job.run();

    expect(first.reset).toBeGreaterThanOrEqual(1);
    expect(second).toMatchObject({ reset: 0, reEnqueued: 0 });
    expect(await rowOf(record.id)).toMatchObject({ status: "uploaded", attempts: 1, error_message: "No active job while processing" });
    expect(await extractionQueue.getJob(record.id)).toMatchObject({ data: { uploadedResumeId: record.id } });
  });

  it("fails a stale processing record with no attempt left and deletes its object", async () => {
    const record = await processingRecord(EXTRACTION_MAX_ATTEMPTS);
    await backdate("uploaded_resumes", record.id, STALE_MS + MINUTE_MS);

    const report = await job.run();

    expect(report.failed).toBeGreaterThanOrEqual(1);
    expect(await rowOf(record.id)).toMatchObject({ status: "failed", error_code: "extraction_failed" });
    expect(await storage.head(record.object_key)).toBeUndefined();
  });

  it("leaves a processing record alone while it is fresh or while its job is still pending", async () => {
    const fresh = await processingRecord(1);
    const withJob = await processingRecord(1);
    await backdate("uploaded_resumes", withJob.id, STALE_MS + MINUTE_MS);
    await extractionQueue.add("extract", { uploadedResumeId: withJob.id, maxAttempts: 3 }, { jobId: withJob.id, delay: 60_000 });

    const report = await job.run();

    expect(report).toMatchObject({ reset: 0, failed: 0 });
    expect((await rowOf(fresh.id)).status).toBe("processing");
    expect((await rowOf(withJob.id)).status).toBe("processing");
  });

  it("re-enqueues a queued Ingestion that has no job, and fails one with no attempt left together with its record", async () => {
    const orphan = await queuedIngestion((await createAccountPair(database)).owner);
    await backdate("ingestions", orphan.id, STALE_MS + MINUTE_MS);
    const record = await processingRecord(1);
    const exhausted = await queuedIngestion(record.account_id);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await ingestionRuns.beginAttempt(exhausted.id);
    }

    await database.updateTable("uploaded_resumes").set({ ingestion_id: exhausted.id }).where("id", "=", record.id).execute();
    await backdate("ingestions", exhausted.id, STALE_MS + MINUTE_MS);
    await backdate("uploaded_resumes", record.id, STALE_MS + MINUTE_MS);

    const report = await job.run();

    expect(report).toMatchObject({ ingestionsReEnqueued: 1, ingestionsFailed: 1 });
    expect(await ingestionRowOf(orphan.id)).toMatchObject({ status: "queued" });
    expect(await ingestionQueue.getJob(orphan.id)).toMatchObject({ data: { ingestionId: orphan.id, maxAttempts: MAX_ATTEMPTS } });
    expect(await ingestionRowOf(exhausted.id)).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
    expect(await rowOf(record.id)).toMatchObject({ status: "failed", error_code: "profile_build_failed" });
  });

  it("deletes an orphaned object older than seven days and keeps a fresh one", async () => {
    const orphanKey = `${RESUME_OBJECT_PREFIX}${randomUUID()}/${randomUUID()}.pdf`;
    await putObject(orphanKey, pdfBytes());
    const failed = await processingRecord(EXTRACTION_MAX_ATTEMPTS);
    await runs.markFailed(failed.id, "extraction_failed", "kept for the sweep");
    const live = await uploadedRecord();

    await job.run();

    expect(await storage.head(orphanKey)).toBeDefined();
    expect(await storage.head(failed.object_key)).toBeDefined();

    clock.advance(ORPHAN_OBJECT_AGE_MS + MINUTE_MS);
    const aged = await job.run();

    expect(aged.objectsDeleted).toBeGreaterThanOrEqual(2);
    expect(await storage.head(orphanKey)).toBeUndefined();
    expect(await storage.head(failed.object_key)).toBeUndefined();
    expect(await storage.head(live.object_key)).toBeDefined();
  });

  it("runs once per interval however many workers schedule it", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    let started = 0;
    const counting = {
      run: () => {
        started += 1;

        return Promise.resolve();
      },
    };
    consumers.push(await build([WorkerModule], counting), await build([WorkerModule], counting));

    await until(() => Promise.resolve(started >= 1));
    const seen = started;
    await sleep(3_000);

    expect(started - seen).toBeGreaterThanOrEqual(2);
    expect(started - seen).toBeLessThanOrEqual(4);
  });
});
