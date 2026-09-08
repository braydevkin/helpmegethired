import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { INestApplicationContext, ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDF_CONTENT_TYPE, RESUME_MAX_SIZE_BYTES, type Id } from "@helpmegethired/shared";
import type { Job, Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import type { UploadedResumeRow } from "../database/database.schema";
import { createAccountPair } from "../database/testing/account-pair";
import { IngestionRunRepository } from "../ingestion/ingestion-run.repository";
import { PROFILE_INGESTION_QUEUE, QUEUE_PREFIX, RESUME_EXTRACTION_QUEUE } from "../queue/queues";
import { WORKER_SETTINGS } from "../queue/worker-settings";
import { ResumeExtractionQueue } from "../resumes/resume-extraction-queue";
import { resumeObjectKeyFor } from "../resumes/resume-object-key";
import { ResumesModule } from "../resumes/resumes.module";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { EXTRACTION_MAX_ATTEMPTS } from "../resumes/uploaded-resume.service";
import { ObjectStorage } from "../storage/object-storage";
import { StorageModule } from "../storage/storage.module";
import { WorkerModule } from "../worker/worker.module";
import { ExtractionModule } from "./extraction.module";
import { PdfTextExtractor } from "./pdf-text-extractor";
import { PdfjsTextExtractor } from "./pdfjs-text-extractor";
import { POPPLER_SETTINGS, PopplerTextExtractor, type PopplerSettings } from "./poppler-text-extractor";
import { ResumeExtractionProcessor } from "./resume-extraction.processor";
import { TextExtractor, type ExtractedText } from "./text-extractor";
import { UploadedResumeRunRepository } from "./uploaded-resume-run.repository";

const SETTLE_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;
const HANG_TIMEOUT_MS = 300;

const hostileDirectory = join(__dirname, "../../test/fixtures/resumes/hostile");
const hostile = (name: string) => readFileSync(join(hostileDirectory, `${name}.pdf`));
const oversized = () => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(RESUME_MAX_SIZE_BYTES, 0x41)]);

const hangingPdftotext: PopplerSettings = {
  command: ["node", "-e", "process.stdin.resume(); setTimeout(() => {}, 60000);", "--"],
  timeoutMs: HANG_TIMEOUT_MS,
};
const missingPdftotext: PopplerSettings = { command: ["pdftotext-that-is-not-installed"], timeoutMs: 10_000 };
const installedPdftotext: PopplerSettings = { command: ["pdftotext"], timeoutMs: 10_000 };

// Decided while the file loads, because skipIf reads it when the tests are collected.
const popplerInstalled = spawnSync(installedPdftotext.command[0], ["-v"]).error === undefined;

class CountingExtractor extends TextExtractor {
  calls = 0;

  constructor(private readonly inner: TextExtractor) {
    super();
  }

  extract(bytes: Buffer): Promise<ExtractedText> {
    this.calls += 1;

    return this.inner.extract(bytes);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;

  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the extraction");
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

describe("resume extraction", () => {
  const prefix = `test-${randomUUID()}`;
  const consumers: INestApplicationContext[] = [];
  let producer: INestApplicationContext;
  let database: Database;
  let storage: ObjectStorage;
  let uploads: UploadedResumeRepository;
  let runs: UploadedResumeRunRepository;
  let processor: ResumeExtractionProcessor;
  let extractor: CountingExtractor;

  const build = async (imports: ModuleMetadata["imports"], poppler?: PopplerSettings): Promise<INestApplicationContext> => {
    const builder = Test.createTestingModule({ imports })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(prefix)
      .overrideProvider(WORKER_SETTINGS)
      .useValue({ concurrency: 1, lockDurationMs: 5_000, stalledIntervalMs: 5_000 })
      .overrideProvider(TextExtractor)
      .useFactory({
        factory: (primary: PopplerTextExtractor, fallback: PdfjsTextExtractor) =>
          new CountingExtractor(new PdfTextExtractor(primary, fallback)),
        inject: [PopplerTextExtractor, PdfjsTextExtractor],
      });

    if (poppler) {
      builder.overrideProvider(POPPLER_SETTINGS).useValue(poppler);
    }

    return (await builder.compile()).init();
  };

  const startConsumer = async (poppler?: PopplerSettings): Promise<INestApplicationContext> => {
    const consumer = await build([WorkerModule], poppler);

    consumers.push(consumer);

    return consumer;
  };

  const rowOf = (id: Id): Promise<UploadedResumeRow> =>
    database.selectFrom("uploaded_resumes").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const objectPresent = async (row: UploadedResumeRow): Promise<boolean> => (await storage.head(row.object_key)) !== undefined;

  const uploaded = async (bytes: Buffer): Promise<UploadedResumeRow> => {
    const { owner } = await createAccountPair(database);
    const id = randomUUID();
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const objectKey = resumeObjectKeyFor(owner, id);

    await uploads.create(owner, {
      id,
      fileName: "candidate.pdf",
      sizeBytes: bytes.length,
      sha256,
      objectKey,
      maxAttempts: EXTRACTION_MAX_ATTEMPTS,
    });

    const presigned = await storage.presignPut(objectKey, bytes.length, sha256, PDF_CONTENT_TYPE);
    const response = await fetch(presigned.url, { method: "PUT", headers: presigned.headers, body: bytes });

    expect(response.ok).toBe(true);
    await uploads.markUploaded(owner, id);

    return rowOf(id);
  };

  // The row fails before BullMQ records the job's last failure, so the job is awaited on its own.
  const failedJob = async (id: Id): Promise<Job> => {
    const queue = producer.get<Queue>(RESUME_EXTRACTION_QUEUE);

    await until(async () => (await (await queue.getJob(id))?.isFailed()) ?? false);

    const job = await queue.getJob(id);

    if (!job) {
      throw new Error(`No job ${id}`);
    }

    return job;
  };

  const settled = async (id: Id): Promise<UploadedResumeRow> => {
    await until(async () => ["done", "failed"].includes((await rowOf(id)).status));

    return rowOf(id);
  };

  beforeAll(async () => {
    producer = await build([EnvironmentModule, DatabaseModule, StorageModule, ResumesModule, ExtractionModule]);
    database = producer.get(DATABASE);
    storage = producer.get(ObjectStorage);
    uploads = producer.get(UploadedResumeRepository);
    runs = producer.get(UploadedResumeRunRepository);
    processor = producer.get(ResumeExtractionProcessor);
    extractor = producer.get(TextExtractor);
  });

  afterEach(async () => {
    await Promise.all(consumers.splice(0).map((consumer) => consumer.close()));
    extractor.calls = 0;
  });

  afterAll(async () => {
    await producer.get<Queue>(RESUME_EXTRACTION_QUEUE).obliterate({ force: true });
    await producer.get<Queue>(PROFILE_INGESTION_QUEUE).obliterate({ force: true });
    await producer.close();
  });

  it.each([
    ["wrong-magic-bytes", "not_pdf", () => hostile("wrong-magic-bytes")],
    ["malformed-xref", "corrupt_pdf", () => hostile("malformed-xref")],
    ["encrypted", "encrypted_pdf", () => hostile("encrypted")],
    ["image-only", "scanned_pdf", () => hostile("image-only")],
    ["too-many-pages", "too_many_pages", () => hostile("too-many-pages")],
    ["oversized", "too_large", oversized],
  ])("fails %s with %s, stores no text, and deletes the object", async (_name, code, bytes) => {
    const record = await uploaded(bytes());

    await processor.process(record.id);

    const row = await rowOf(record.id);

    expect(row).toMatchObject({ status: "failed", error_code: code, raw_text: null, extractor_version: null, attempts: 1 });
    expect(row.error_message).toEqual(expect.any(String));
    expect(row.finished_at).toBeInstanceOf(Date);
    expect(await objectPresent(row)).toBe(false);
  });

  it("extracts a text PDF with a JavaScript action, stores the text and the extractor version, deletes the object, and hands over to an Ingestion", async () => {
    const record = await uploaded(hostile("embedded-javascript"));

    await processor.process(record.id);

    const row = await rowOf(record.id);

    expect(row).toMatchObject({ status: "processing", error_code: null, error_message: null, attempts: 1, ingestion_id: expect.any(String) });
    expect(row.raw_text).toContain("Ada Lovelace - Senior Software Engineer");
    expect(row.raw_text).not.toContain("hostile");
    expect(row.extractor_version).toMatch(popplerInstalled ? /^pdftotext\/\d+\.\d+/ : /^pdfjs-dist\/\d+\.\d+/);
    expect(row.finished_at).toBeNull();
    expect(await objectPresent(row)).toBe(false);
    expect(await producer.get(IngestionRunRepository).findById(row.ingestion_id ?? "")).toMatchObject({ accountId: row.account_id, status: "queued" });
  });

  it("never extracts again when a job is re-delivered after the text was saved, and never starts a second Ingestion", async () => {
    const record = await uploaded(hostile("embedded-javascript"));
    await runs.beginAttempt(record.id);
    await runs.saveText(record.id, { text: "saved before the crash", extractorVersion: "pdftotext/0.0.0" });

    await processor.process(record.id);
    const linked = await rowOf(record.id);
    await processor.process(record.id);

    const row = await rowOf(record.id);

    expect(row).toMatchObject({ status: "processing", raw_text: "saved before the crash", extractor_version: "pdftotext/0.0.0", attempts: 1 });
    expect(row.ingestion_id).toBe(linked.ingestion_id);
    expect(extractor.calls).toBe(0);
    expect(await objectPresent(row)).toBe(false);
  });

  it("consumes the extraction job on the worker, which then builds the Profile and marks the record done", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    await startConsumer();
    const record = await uploaded(hostile("embedded-javascript"));

    await producer.get(ResumeExtractionQueue).enqueue({ uploadedResumeId: record.id, maxAttempts: record.max_attempts });

    const row = await settled(record.id);

    expect(row.status).toBe("done");
    expect(row.finished_at).toBeInstanceOf(Date);
    expect(await producer.get(IngestionRunRepository).findById(row.ingestion_id ?? "")).toMatchObject({ status: "completed" });
    expect(row.raw_text).toContain("Ada Lovelace");
    expect(await objectPresent(row)).toBe(false);
  });

  it("kills a hung extraction at the timeout, retries, and fails with extraction_failed once the attempts are used", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    await startConsumer(hangingPdftotext);
    const record = await uploaded(hostile("embedded-javascript"));

    await producer.get(ResumeExtractionQueue).enqueue({ uploadedResumeId: record.id, maxAttempts: record.max_attempts });

    const row = await settled(record.id);
    const job = await failedJob(record.id);

    expect(row).toMatchObject({ status: "failed", error_code: "extraction_failed", raw_text: null, attempts: EXTRACTION_MAX_ATTEMPTS });
    expect(row.error_message).toContain(`longer than ${HANG_TIMEOUT_MS} ms`);
    expect(await objectPresent(row)).toBe(false);
    expect(job.attemptsMade).toBe(EXTRACTION_MAX_ATTEMPTS);
  });

  it("falls back to pdfjs-dist when pdftotext is not installed", async () => {
    const consumer = await startConsumer(missingPdftotext);
    const record = await uploaded(hostile("embedded-javascript"));

    await consumer.get(ResumeExtractionProcessor).process(record.id);

    const row = await rowOf(record.id);

    expect(row.status).toBe("processing");
    expect(row.raw_text).toContain("Ada Lovelace - Senior Software Engineer");
    expect(row.extractor_version).toMatch(/^pdfjs-dist\/\d+\.\d+/);
  });

  it.skipIf(!popplerInstalled)("extracts with the installed pdftotext and records its version", async () => {
    const extracted = await producer.get(PopplerTextExtractor).extract(hostile("embedded-javascript"));

    expect(extracted.text).toContain("Ada Lovelace - Senior Software Engineer");
    expect(extracted.extractorVersion).toMatch(/^pdftotext\/\d+\.\d+/);
  });
});
