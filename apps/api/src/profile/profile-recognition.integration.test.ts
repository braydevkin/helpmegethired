import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { INestApplication, INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ProfileRecognitionReceiptSchema, SESSION_LIFETIME_SECONDS, type Id } from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { hashSessionToken } from "../auth/session-token";
import { SessionRepository } from "../auth/session.repository";
import { EnvironmentModule } from "../config/environment.module";
import { CurationQueue } from "../curation/curation-queue";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { ExtractionHandover } from "../extraction/extraction-handover";
import { UploadedResumeRunRepository } from "../extraction/uploaded-resume-run.repository";
import { IngestionQueue, type IngestionJob } from "../ingestion/ingestion-queue";
import { IngestionRepository } from "../ingestion/ingestion.repository";
import { IngestionRunner } from "../ingestion/ingestion.runner";
import { MAX_ATTEMPTS } from "../ingestion/ingestion.service";
import { SegmentProcessorRegistry } from "../ingestion/segment-processor.registry";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { QUEUE_PREFIX } from "../queue/queues";
import { resumeObjectKeyFor } from "../resumes/resume-object-key";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { EXTRACTION_MAX_ATTEMPTS } from "../resumes/uploaded-resume.service";
import { ProfileCorrectionService } from "./profile-correction.service";
import { ProfileIngestionModule } from "./profile-ingestion.module";
import { ProfileRecognitionRefusedError } from "./profile-recognition-errors";
import { ProfileRecognitionModule } from "./profile-recognition.module";
import { ProfileRecognitionService } from "./profile-recognition.service";
import { ProfileService } from "./profile.service";

const corpus = join(__dirname, "../../test/fixtures/resumes/corpus");
const fixture = (slug: string) => readFileSync(join(corpus, `${slug}.txt`), "utf8");

class RecordingIngestionQueue extends IngestionQueue {
  readonly jobs: IngestionJob[] = [];

  enqueue(job: IngestionJob): Promise<void> {
    this.jobs.push(job);

    return Promise.resolve();
  }

  work(): Promise<void> {
    return Promise.resolve();
  }

  hasPendingJob(ingestionId: Id): Promise<boolean> {
    return Promise.resolve(this.jobs.some((job) => job.ingestionId === ingestionId));
  }
}

class IdleCurationQueue extends CurationQueue {
  enqueue(): Promise<void> {
    return Promise.resolve();
  }

  work(): Promise<void> {
    return Promise.resolve();
  }

  hasPendingJob(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

const modelKey = () => ({ provider: "anthropic", modelId: "claude-sonnet-5", key: `sk-ant-api03-candidate-${randomUUID()}` }) as const;

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ProfileRecognitionRefusedError ? error.code : error),
  );

describe("reading the stored résumé text again", () => {
  let context: INestApplicationContext;
  let database: Database;
  let accounts: AccountRepository;
  let uploads: UploadedResumeRepository;
  let runs: UploadedResumeRunRepository;
  let handover: ExtractionHandover;
  let runner: IngestionRunner;
  let ingestions: IngestionRepository;
  let registry: SegmentProcessorRegistry;
  let profiles: ProfileService;
  let corrections: ProfileCorrectionService;
  let choices: ModelChoiceService;
  let recognition: ProfileRecognitionService;
  const queue = new RecordingIngestionQueue();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileIngestionModule, ProfileRecognitionModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(IngestionQueue)
      .useValue(queue)
      .overrideProvider(CurationQueue)
      .useValue(new IdleCurationQueue())
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    accounts = context.get(AccountRepository);
    uploads = context.get(UploadedResumeRepository);
    runs = context.get(UploadedResumeRunRepository);
    handover = context.get(ExtractionHandover);
    runner = context.get(IngestionRunner);
    ingestions = context.get(IngestionRepository);
    registry = context.get(SegmentProcessorRegistry);
    profiles = context.get(ProfileService);
    corrections = context.get(ProfileCorrectionService);
    choices = context.get(ModelChoiceService);
    recognition = context.get(ProfileRecognitionService);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const newAccount = async (): Promise<Id> => (await accounts.create({ email: `${randomUUID()}@candidate.example` })).id;

  // An Uploaded Resume as the extraction processor leaves it: its text stored and handed over.
  const handedOver = async (accountId: Id, slug: string): Promise<{ uploadedResumeId: Id; ingestionId: Id }> => {
    const id = randomUUID();

    await uploads.create(accountId, {
      id,
      fileName: `${slug}.pdf`,
      sizeBytes: 1024,
      sha256: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      objectKey: resumeObjectKeyFor(accountId, id),
      maxAttempts: EXTRACTION_MAX_ATTEMPTS,
    });
    await uploads.markUploaded(accountId, id);
    await runs.beginAttempt(id);
    await handover.handOver(await runs.saveText(id, { text: fixture(slug), extractorVersion: "pdftotext/test" }));

    const ingestionId = (await runs.findById(id))?.ingestionId;

    if (!ingestionId) {
      throw new Error("The hand-over did not link an Ingestion");
    }

    return { uploadedResumeId: id, ingestionId };
  };

  const built = async (accountId: Id, slug: string) => {
    const handed = await handedOver(accountId, slug);

    await runner.run(handed.ingestionId);

    return handed;
  };

  const linkedIngestionOf = async (uploadedResumeId: Id): Promise<Id> => {
    const ingestionId = (await runs.findById(uploadedResumeId))?.ingestionId;

    if (!ingestionId) {
      throw new Error("The Uploaded Resume has no Ingestion");
    }

    return ingestionId;
  };

  const curationsOf = (accountId: Id) => database.selectFrom("curations").select(["id", "status"]).where("account_id", "=", accountId).execute();

  it("starts a new Ingestion over the stored text and takes the Uploaded Resume back to processing, linked to it", async () => {
    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");

    await choices.save(accountId, modelKey());

    expect(await recognition.start(accountId)).toEqual({ uploadedResumeId: first.uploadedResumeId });

    const ingestionId = await linkedIngestionOf(first.uploadedResumeId);
    const resume = await uploads.findById(accountId, first.uploadedResumeId);

    expect(ingestionId).not.toBe(first.ingestionId);
    expect(await ingestions.findById(accountId, ingestionId)).toMatchObject({ source: "upload", status: "queued" });
    expect(resume).toMatchObject({ status: "processing", errorCode: null, finishedAt: null });
    expect(queue.jobs.filter((job) => job.ingestionId === ingestionId)).toHaveLength(1);
    expect((await ingestions.segmentsOf(accountId, ingestionId)).map((segment) => segment.kind)).toEqual(
      (await ingestions.segmentsOf(accountId, first.ingestionId)).map((segment) => segment.kind),
    );
    expect((await profiles.get(accountId)).source).toMatchObject({
      ingestionId: first.ingestionId,
      uploadedResumeId: first.uploadedResumeId,
      fileName: "ada-single-column-en.pdf",
    });
  });

  it("replaces the corrected, confirmed Profile once the Ingestion completes, supersedes the completed Curation, and marks the record done", async () => {
    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");
    const before = await profiles.get(accountId);

    await corrections.correctBasicProfile(accountId, { ...before.basicProfile, headline: "Corrected by the Candidate" });
    await choices.save(accountId, modelKey());
    await profiles.confirm(accountId);

    const [curation] = await curationsOf(accountId);

    await database.updateTable("curations").set({ status: "completed" }).where("account_id", "=", accountId).execute();
    await recognition.start(accountId);

    const ingestionId = await linkedIngestionOf(first.uploadedResumeId);

    await runner.run(ingestionId);

    const after = await profiles.get(accountId);

    expect(after.source).toMatchObject({ ingestionId, uploadedResumeId: first.uploadedResumeId });
    expect(after.confirmedAt).toBeNull();
    expect(after.corrections).toEqual({ basicProfile: false, entryIds: [] });
    expect(after.basicProfile.headline).toBe(before.basicProfile.headline);
    expect(after.experiences.map((experience) => experience.role)).toEqual(before.experiences.map((experience) => experience.role));
    expect(await curationsOf(accountId)).toEqual([{ id: curation?.id, status: "superseded" }]);
    expect(await uploads.findById(accountId, first.uploadedResumeId)).toMatchObject({ status: "done", errorCode: null });
  });

  it("keeps the Profile and its source when the reading fails, and lets the Candidate try again", async () => {
    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");

    await choices.save(accountId, modelKey());
    await recognition.start(accountId);

    const failedIngestionId = await linkedIngestionOf(first.uploadedResumeId);

    vi.spyOn(registry.processorFor("header"), "read").mockRejectedValue(new Error("model unreachable"));

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await expect(runner.run(failedIngestionId)).rejects.toThrow("model unreachable");
    }

    vi.restoreAllMocks();

    expect(await uploads.findById(accountId, first.uploadedResumeId)).toMatchObject({ status: "failed", errorCode: "profile_build_failed" });
    expect((await profiles.get(accountId)).source).toMatchObject({ ingestionId: first.ingestionId, uploadedResumeId: first.uploadedResumeId });
    expect(await recognition.start(accountId)).toEqual({ uploadedResumeId: first.uploadedResumeId });
    expect(await linkedIngestionOf(first.uploadedResumeId)).not.toBe(failedIngestionId);
  });

  it("refuses with model_key_missing when no Model Key is stored, or it was revoked", async () => {
    const accountId = await newAccount();

    await built(accountId, "ada-single-column-en");

    expect(await refusalOf(recognition.start(accountId))).toBe("model_key_missing");

    await choices.save(accountId, modelKey());
    await choices.revokeKey(accountId);

    expect(await refusalOf(recognition.start(accountId))).toBe("model_key_missing");
  });

  it("refuses with resume_text_missing before any Profile is built, and when the text is gone", async () => {
    const empty = await newAccount();

    await choices.save(empty, modelKey());

    expect(await refusalOf(recognition.start(empty))).toBe("resume_text_missing");

    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");

    await choices.save(accountId, modelKey());
    await database.updateTable("uploaded_resumes").set({ raw_text: null }).where("id", "=", first.uploadedResumeId).execute();

    expect(await refusalOf(recognition.start(accountId))).toBe("resume_text_missing");
  });

  const activeIngestionsOf = (accountId: Id) =>
    database.selectFrom("ingestions").select("id").where("account_id", "=", accountId).where("status", "in", ["queued", "running"]).execute();

  it("refuses with ingestion_active while another Ingestion is queued, and leaves the record as it was", async () => {
    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");

    await choices.save(accountId, modelKey());

    const second = await handedOver(accountId, "kenji-single-column-en");

    expect(await refusalOf(recognition.start(accountId))).toBe("ingestion_active");
    expect(await uploads.findById(accountId, first.uploadedResumeId)).toMatchObject({ status: "done", ingestionId: first.ingestionId });
    expect(await activeIngestionsOf(accountId)).toEqual([{ id: second.ingestionId }]);
  });

  it("refuses with ingestion_active while another upload waits for its extraction, and starts no Ingestion", async () => {
    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");
    const waiting = randomUUID();

    await choices.save(accountId, modelKey());
    await uploads.create(accountId, {
      id: waiting,
      fileName: "waiting.pdf",
      sizeBytes: 1024,
      sha256: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      objectKey: resumeObjectKeyFor(accountId, waiting),
      maxAttempts: EXTRACTION_MAX_ATTEMPTS,
    });
    await uploads.markUploaded(accountId, waiting);

    expect(await refusalOf(recognition.start(accountId))).toBe("ingestion_active");
    expect(await uploads.findById(accountId, first.uploadedResumeId)).toMatchObject({ status: "done", ingestionId: first.ingestionId });
    expect(await activeIngestionsOf(accountId)).toEqual([]);
  });

  it("refuses with curation_active while a Curation is queued or running, and leaves the record done", async () => {
    const accountId = await newAccount();
    const first = await built(accountId, "ada-single-column-en");

    await choices.save(accountId, modelKey());
    await profiles.confirm(accountId);

    expect((await curationsOf(accountId)).map((curation) => curation.status)).toEqual(["queued"]);

    const jobsBefore = queue.jobs.length;

    expect(await refusalOf(recognition.start(accountId))).toBe("curation_active");
    expect(await uploads.findById(accountId, first.uploadedResumeId)).toMatchObject({ status: "done", ingestionId: first.ingestionId });
    expect(queue.jobs).toHaveLength(jobsBefore);
    expect(await database.selectFrom("ingestions").select("id").where("account_id", "=", accountId).execute()).toHaveLength(1);
  });
});

describe("POST /profile/recognition", () => {
  let app: INestApplication;
  let baseUrl: string;
  let accounts: AccountRepository;
  let sessions: SessionRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  const openSession = async (): Promise<{ accountId: Id; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });
    const token = randomUUID();

    await sessions.create({ accountId: account.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000) });

    return { accountId: account.id, token };
  };

  const storeModelKey = async (token: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/account/model`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(modelKey()),
    });

    expect(response.status).toBe(200);
  };

  const start = (token: string) => fetch(`${baseUrl}/profile/recognition`, { method: "POST", headers: { authorization: `Bearer ${token}` } });

  it("answers 409 model_key_missing to an Account with no Model Key", async () => {
    const response = await start((await openSession()).token);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ statusCode: 409, error: "Conflict", code: "model_key_missing" });
  });

  it("answers 404 resume_text_missing to an Account with a Model Key but no Profile", async () => {
    const { token } = await openSession();

    await storeModelKey(token);

    const response = await start(token);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, error: "Not Found", code: "resume_text_missing" });
  });

  // The API does not run Segments, so the Profile is written as a completed upload Ingestion leaves it.
  const withBuiltProfile = async (accountId: Id): Promise<Id> => {
    const database = app.get<Database>(DATABASE);
    const uploadedResumeId = randomUUID();
    const ingestion = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: MAX_ATTEMPTS, last_error: null, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();

    await database
      .insertInto("uploaded_resumes")
      .values({
        id: uploadedResumeId,
        account_id: accountId,
        sha256: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        file_name: "ada-single-column-en.pdf",
        size_bytes: 1024,
        object_key: resumeObjectKeyFor(accountId, uploadedResumeId),
        status: "done",
        error_code: null,
        error_message: null,
        raw_text: fixture("ada-single-column-en"),
        extractor_version: "pdftotext/test",
        max_attempts: EXTRACTION_MAX_ATTEMPTS,
        ingestion_id: ingestion.id,
        finished_at: new Date(),
      })
      .execute();

    return uploadedResumeId;
  };

  it("answers 202 with the Uploaded Resume it reads again, which GET /resumes/:id shows processing", async () => {
    const { accountId, token } = await openSession();
    const uploadedResumeId = await withBuiltProfile(accountId);

    await storeModelKey(token);

    const response = await start(token);

    expect(response.status).toBe(202);
    expect(ProfileRecognitionReceiptSchema.parse(await response.json())).toEqual({ uploadedResumeId });

    const resume = await fetch(`${baseUrl}/resumes/${uploadedResumeId}`, { headers: { authorization: `Bearer ${token}` } });

    expect(await resume.json()).toMatchObject({ id: uploadedResumeId, status: "processing", progress: { percentage: 0 } });

    const again = await start(token);

    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "ingestion_active" });
  });

  it("refuses an anonymous request", async () => {
    expect((await fetch(`${baseUrl}/profile/recognition`, { method: "POST" })).status).toBe(401);
  });
});
