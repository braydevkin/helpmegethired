import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Logger, type INestApplicationContext, type ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDF_CONTENT_TYPE, type Id } from "@helpmegethired/shared";
import type { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Clock } from "../common/clock";
import { EnvironmentModule } from "../config/environment.module";
import { CURATION_MAX_ATTEMPTS } from "../curation/curation-job-options";
import { CurationRunRepository } from "../curation/curation-run.repository";
import { CurationModel, type CurationAnswer, type CurationCall } from "../curation/model/curation-model";
import { ProviderRateLimitedError } from "../curation/model/curation-model-errors";
import { FakeCurationModel } from "../curation/model/fake-curation-model";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import type { CurationRow, CurationUnitRow, IngestionRow, UploadedResumeRow } from "../database/database.schema";
import { createAccountPair } from "../database/testing/account-pair";
import { TransactionRunner } from "../database/transaction-runner";
import { ExtractionModule } from "../extraction/extraction.module";
import { UploadedResumeRunRepository } from "../extraction/uploaded-resume-run.repository";
import { IngestionRunRepository } from "../ingestion/ingestion-run.repository";
import { IngestionModule } from "../ingestion/ingestion.module";
import { IngestionRepository } from "../ingestion/ingestion.repository";
import { MAX_ATTEMPTS } from "../ingestion/ingestion.service";
import { ModelChoiceModule } from "../model-choice/model-choice.module";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileModule } from "../profile/profile.module";
import { ProfileService } from "../profile/profile.service";
import { PROFILE_CURATION_QUEUE, PROFILE_INGESTION_QUEUE, QUEUE_PREFIX, RECONCILIATION_QUEUE, RESUME_EXTRACTION_QUEUE } from "../queue/queues";
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
const RETRY_AFTER_SECONDS = 120;
const CURATION_ACTION_LINE = /^reconciliation action=(?:reset|fail|re-enqueue) curation=[\da-f-]{36}$/;

// Rate-limits the first call made with one Candidate's key, so the other Curations the worker
// picks up from earlier tests run as usual.
class RateLimitedOnce extends CurationModel {
  private readonly fake = new FakeCurationModel();
  private limited = false;

  constructor(private readonly limitedKey: string) {
    super();
  }

  generate(call: CurationCall): Promise<CurationAnswer> {
    if (!this.limited && call.modelKey.reveal() === this.limitedKey) {
      this.limited = true;

      return Promise.reject(new ProviderRateLimitedError(RETRY_AFTER_SECONDS));
    }

    return this.fake.generate(call);
  }
}

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
  let curationQueue: Queue;
  let curationRuns: CurationRunRepository;

  const build = async (imports: ModuleMetadata["imports"], overrides: { job?: { run: () => Promise<void> }; model?: CurationModel } = {}) => {
    const builder = Test.createTestingModule({ imports })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(prefix)
      .overrideProvider(WORKER_SETTINGS)
      .useValue({ concurrency: 1, lockDurationMs: 5_000, stalledIntervalMs: 5_000 })
      .overrideProvider(RECONCILIATION_SETTINGS)
      .useValue(settings)
      .overrideProvider(Clock)
      .useValue(clock);

    if (overrides.job) {
      builder.overrideProvider(ReconciliationJob).useValue(overrides.job);
    }

    if (overrides.model) {
      builder.overrideProvider(CurationModel).useValue(overrides.model);
    }

    return (await builder.compile()).init();
  };

  const rowOf = (id: Id): Promise<UploadedResumeRow> =>
    database.selectFrom("uploaded_resumes").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const ingestionRowOf = (id: Id): Promise<IngestionRow> =>
    database.selectFrom("ingestions").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const curationRowOf = (id: Id): Promise<CurationRow> => database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const curationUnitsOf = (id: Id): Promise<CurationUnitRow[]> =>
    database.selectFrom("curation_units").selectAll().where("curation_id", "=", id).orderBy("position").execute();

  const backdate = (table: "uploaded_resumes" | "ingestions" | "curations", id: Id, ms: number) =>
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

  // A confirmed Profile with a stored Model Key, which leaves a queued Curation with its job (#112).
  const curatedAccount = async (): Promise<{ accountId: Id; curationId: Id; modelKey: string }> => {
    const { owner: accountId } = await createAccountPair(database);
    const { id: ingestionId } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: MAX_ATTEMPTS, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id: segmentId } = await database
      .insertInto("ingestion_segments")
      .values({ ingestion_id: ingestionId, position: 0, kind: "experience", status: "saved", input: "{}" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const profileRow = { account_id: accountId, source_ingestion_id: ingestionId, segment_id: segmentId, segment_position: 0, position: 0 };
    const modelKey = `sk-ant-api03-candidate-${randomUUID()}`;

    await database.insertInto("basic_profiles").values({ account_id: accountId, source_ingestion_id: ingestionId, segment_id: segmentId }).execute();
    await database
      .insertInto("experiences")
      .values({ ...profileRow, role: "Platform Engineer", company: "Parapet Systems", period_start: "2020-01", period_end: "2021-12", description: "Moved the build cache to object storage.", skills: "[]" })
      .execute();
    await database.insertInto("projects").values({ ...profileRow, name: "Bastion", description: "Rotates short-lived credentials.", skills: "[]" }).execute();
    await producer.get(ModelChoiceService).save(accountId, { provider: "anthropic", modelId: "claude-sonnet-5", key: modelKey });
    await producer.get(ProfileService).confirm(accountId);

    const { id: curationId } = await database.selectFrom("curations").select("id").where("account_id", "=", accountId).executeTakeFirstOrThrow();

    return { accountId, curationId, modelKey };
  };

  // The enqueue after commit was lost, as a Redis outage at the wrong moment leaves it.
  const orphanedCuration = async (): Promise<{ accountId: Id; curationId: Id }> => {
    const curated = await curatedAccount();

    await curationQueue.remove(curated.curationId);

    return curated;
  };

  // A worker that began an attempt and a unit, then died without reporting.
  const killedMidRun = async (attempts = 1): Promise<{ accountId: Id; curationId: Id }> => {
    const curated = await orphanedCuration();

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await curationRuns.beginAttempt(curated.curationId);
    }

    const [first] = await curationUnitsOf(curated.curationId);
    await curationRuns.beginUnit(first!.id, false);

    return curated;
  };

  beforeAll(async () => {
    producer = await build([
      EnvironmentModule,
      DatabaseModule,
      StorageModule,
      IngestionModule,
      ResumesModule,
      ExtractionModule,
      ProfileModule,
      ModelChoiceModule,
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
    curationQueue = producer.get<Queue>(PROFILE_CURATION_QUEUE);
    curationRuns = producer.get(CurationRunRepository);
  });

  afterEach(async () => {
    await Promise.all(consumers.splice(0).map((consumer) => consumer.close()));
    clock.reset();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    for await (const page of storage.list(RESUME_OBJECT_PREFIX)) {
      await Promise.all(page.map((object) => storage.delete(object.key)));
    }

    await Promise.all(
      [extractionQueue, ingestionQueue, curationQueue, producer.get<Queue>(RECONCILIATION_QUEUE)].map((queue) => queue.obliterate({ force: true })),
    );
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

  it("re-enqueues a queued Curation that has no job, and only once", async () => {
    const { curationId } = await orphanedCuration();

    expect(await curationQueue.getJob(curationId)).toBeUndefined();

    const first = await job.run();
    const second = await job.run();

    expect(first.curationsReEnqueued).toBeGreaterThanOrEqual(1);
    expect(second.curationsReEnqueued).toBe(0);
    expect(await curationQueue.getJob(curationId)).toMatchObject({ data: { curationId, maxAttempts: CURATION_MAX_ATTEMPTS } });
  });

  it("resets a Curation whose worker was killed mid-run, logs ids only, and a worker resumes it to completed", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    const { curationId } = await killedMidRun();
    await backdate("curations", curationId, STALE_MS + MINUTE_MS);
    const log = vi.spyOn(Logger.prototype, "log");

    const first = await job.run();
    const second = await job.run();

    expect(first.curationsReset).toBeGreaterThanOrEqual(1);
    expect(second).toMatchObject({ curationsReset: 0, curationsReEnqueued: 0 });
    expect(await curationRowOf(curationId)).toMatchObject({ status: "queued", attempts: 1, failure_reason: null });
    expect((await curationUnitsOf(curationId)).map((unit) => unit.status)).toEqual(["pending", "pending", "pending", "pending"]);
    expect(await curationQueue.getJob(curationId)).toMatchObject({ data: { curationId, maxAttempts: CURATION_MAX_ATTEMPTS } });

    const curationLines = log.mock.calls.map(([line]) => String(line)).filter((line) => line.includes(" curation="));

    expect(curationLines).toContain(`reconciliation action=reset curation=${curationId}`);
    expect(curationLines.every((line) => CURATION_ACTION_LINE.test(line))).toBe(true);

    consumers.push(await build([WorkerModule]));

    await until(async () => ["completed", "failed"].includes((await curationRowOf(curationId)).status));
    expect(await curationRowOf(curationId)).toMatchObject({ status: "completed", attempts: 2 });
  });

  it("fails a killed Curation with no attempt left, which frees the Account for a new one", async () => {
    const { accountId, curationId } = await killedMidRun(CURATION_MAX_ATTEMPTS);
    await backdate("curations", curationId, STALE_MS + MINUTE_MS);

    const report = await job.run();

    expect(report.curationsFailed).toBeGreaterThanOrEqual(1);
    expect(await curationRowOf(curationId)).toMatchObject({ status: "failed", failure_reason: "attempts_exhausted", attempts: CURATION_MAX_ATTEMPTS });

    await producer.get(ProfileService).confirm(accountId);

    const next = await database.selectFrom("curations").select("status").where("account_id", "=", accountId).where("id", "!=", curationId).executeTakeFirst();

    expect(next).toEqual({ status: "queued" });
  });

  it("leaves a running Curation alone while it is fresh or while its job will still be delivered", async () => {
    const fresh = await killedMidRun();
    const withJob = await curatedAccount();
    await curationRuns.beginAttempt(withJob.curationId);
    await backdate("curations", withJob.curationId, STALE_MS + MINUTE_MS);

    await job.run();

    expect(await curationRowOf(fresh.curationId)).toMatchObject({ status: "running", attempts: 1 });
    expect(await curationRowOf(withJob.curationId)).toMatchObject({ status: "running", attempts: 1 });
  });

  it("waits out resume_after after a Provider rate limit, then enqueues the Curation again under its finished job's id", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    const { curationId, modelKey } = await curatedAccount();
    consumers.push(await build([WorkerModule], { model: new RateLimitedOnce(modelKey) }));

    await until(async () => (await curationQueue.getJob(curationId))?.finishedOn !== undefined);
    const paused = await curationRowOf(curationId);

    expect(paused).toMatchObject({ status: "queued", attempts: 0 });
    expect(paused.resume_after?.getTime()).toBeGreaterThan(clock.now().getTime());

    await job.run();

    expect(await (await curationQueue.getJob(curationId))?.getState()).toBe("completed");
    expect(await curationRowOf(curationId)).toMatchObject({ status: "queued", attempts: 0 });

    await database.updateTable("curations").set({ resume_after: new Date(clock.now().getTime() - MINUTE_MS) }).where("id", "=", curationId).execute();
    await job.run();

    await until(async () => ["completed", "failed"].includes((await curationRowOf(curationId)).status));
    expect(await curationRowOf(curationId)).toMatchObject({ status: "completed", attempts: 1, resume_after: null });
  });

  it("keeps one schedule however many workers upsert it, and runs it again every interval", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    let started = 0;
    const counting = {
      run: () => {
        started += 1;

        return Promise.resolve();
      },
    };
    const reconciliationQueue = producer.get<Queue>(RECONCILIATION_QUEUE);
    consumers.push(await build([WorkerModule], { job: counting }), await build([WorkerModule], { job: counting }));

    await until(() => Promise.resolve(started >= 3));

    expect(await reconciliationQueue.getJobSchedulersCount()).toBe(1);
    expect(await reconciliationQueue.getDelayedCount()).toBeLessThanOrEqual(1);
  });
});
