import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IngestionProgressSchema, IngestionSchema, type Id } from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AccountRepository } from "../auth/account.repository";
import { AuthModule } from "../auth/auth.module";
import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { IngestionAlreadyActiveError } from "./ingestion-errors";
import { IngestionQueue, type IngestionJob, type IngestionJobHandler } from "./ingestion-queue";
import { IngestionModule } from "./ingestion.module";
import { IngestionRepository } from "./ingestion.repository";
import { IngestionRunner } from "./ingestion.runner";
import { IngestionService, MAX_ATTEMPTS } from "./ingestion.service";
import { ScriptedSegmentProcessor } from "./scripted-segment-processor.fixture";
import { SEGMENT_PROCESSORS } from "./segment-processor";

class RecordingQueue extends IngestionQueue {
  readonly jobs: IngestionJob[] = [];
  handler?: IngestionJobHandler;
  private rejectNext?: Error;

  failNextEnqueueWith(error: Error): void {
    this.rejectNext = error;
  }

  enqueue(job: IngestionJob): Promise<void> {
    if (this.rejectNext) {
      const error = this.rejectNext;

      this.rejectNext = undefined;

      return Promise.reject(error);
    }

    this.jobs.push(job);

    return Promise.resolve();
  }

  work(handler: IngestionJobHandler): Promise<void> {
    this.handler = handler;

    return Promise.resolve();
  }
}

const threeSegments = ["first experience", "second experience", "third experience"].map((text) => ({
  kind: "experience",
  input: { text },
}));

describe("profile ingestion", () => {
  let context: INestApplicationContext;
  let accounts: AccountRepository;
  let service: IngestionService;
  let runner: IngestionRunner;
  let repository: IngestionRepository;
  let queue: RecordingQueue;
  let processor: ScriptedSegmentProcessor;
  let accountId: Id;

  beforeAll(async () => {
    processor = new ScriptedSegmentProcessor();
    queue = new RecordingQueue();

    const moduleRef = await Test.createTestingModule({
      imports: [EnvironmentModule, DatabaseModule, AuthModule, IngestionModule],
    })
      .overrideProvider(SEGMENT_PROCESSORS)
      .useValue([processor])
      .overrideProvider(IngestionQueue)
      .useValue(queue)
      .compile();

    context = await moduleRef.init();
    accounts = context.get(AccountRepository);
    service = context.get(IngestionService);
    runner = context.get(IngestionRunner);
    repository = context.get(IngestionRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    const account = await accounts.create({
      email: `${crypto.randomUUID()}@candidate.example`,
      passwordHash: "scrypt$32768$8$1$c2FsdA==$a2V5",
    });

    accountId = account.id;
  });

  afterEach(() => {
    processor.calls.length = 0;
    processor.saved.clear();
  });

  const statusesOf = async (ingestionId: Id) =>
    (await repository.segmentsOf(ingestionId)).map((segment) => segment.status);

  describe("start", () => {
    it("persists a queued Ingestion with its Segments in order and enqueues one job", async () => {
      const ingestion = await service.start(accountId, threeSegments);

      expect(IngestionSchema.safeParse(ingestion)).toMatchObject({ success: true });
      expect(ingestion).toMatchObject({ accountId, status: "queued", attempts: 0, maxAttempts: MAX_ATTEMPTS });
      expect(await statusesOf(ingestion.id)).toEqual(["pending", "pending", "pending"]);
      expect(queue.jobs).toContainEqual({ ingestionId: ingestion.id, maxAttempts: MAX_ATTEMPTS });
    });

    it("keeps no Ingestion when the job cannot be enqueued, so the Account stays free", async () => {
      queue.failNextEnqueueWith(new Error("queue unavailable"));

      await expect(service.start(accountId, threeSegments)).rejects.toThrow("queue unavailable");

      await expect(service.start(accountId, threeSegments)).resolves.toMatchObject({ status: "queued" });
    });

    it("rejects a second Ingestion for the same Account while one is active", async () => {
      await service.start(accountId, threeSegments);

      await expect(service.start(accountId, threeSegments)).rejects.toThrow(IngestionAlreadyActiveError);
    });

    it("accepts a new Ingestion once the previous one has completed", async () => {
      const first = await service.start(accountId, threeSegments);

      await runner.run(first.id);

      await expect(service.start(accountId, threeSegments)).resolves.toMatchObject({ status: "queued" });
    });
  });

  describe("run", () => {
    it("reads, recognises and saves every Segment in order and completes the Ingestion", async () => {
      const ingestion = await service.start(accountId, threeSegments);

      await runner.run(ingestion.id);

      expect(processor.calls.map((call) => `${call.step}:${call.position}`)).toEqual([
        "read:0",
        "recognize:0",
        "save:0",
        "read:1",
        "recognize:1",
        "save:1",
        "read:2",
        "recognize:2",
        "save:2",
      ]);
      expect(processor.saved.get(1)).toEqual({ summary: "second-experience" });
      expect(await repository.findById(ingestion.id)).toMatchObject({ status: "completed", attempts: 1 });
      expect(await service.progressOf(ingestion.id)).toMatchObject({ percentage: 100, segments: { total: 3, saved: 3 } });
    });

    it("resumes a failed Ingestion from the step that failed, without redoing completed work", async () => {
      processor.failOnceAt("recognize", 1);
      const ingestion = await service.start(accountId, threeSegments);

      await expect(runner.run(ingestion.id)).rejects.toThrow("recognize of segment 1 failed");

      expect(await repository.findById(ingestion.id)).toMatchObject({
        status: "queued",
        attempts: 1,
        lastError: "recognize of segment 1 failed",
      });
      expect(await statusesOf(ingestion.id)).toEqual(["saved", "read", "pending"]);
      expect(await service.progressOf(ingestion.id)).toMatchObject({ percentage: 44, segments: { total: 3, saved: 1 } });

      await runner.run(ingestion.id);

      expect(processor.callsFor("read")).toEqual([0, 1, 2]);
      expect(processor.callsFor("recognize")).toEqual([0, 1, 1, 2]);
      expect(processor.callsFor("save")).toEqual([0, 1, 2]);
      expect(await statusesOf(ingestion.id)).toEqual(["saved", "saved", "saved"]);
      expect(await repository.findById(ingestion.id)).toMatchObject({ status: "completed", attempts: 2, lastError: null });
    });

    it("keeps the error on the Segment that failed until it succeeds", async () => {
      processor.failOnceAt("save", 2);
      const ingestion = await service.start(accountId, threeSegments);

      await expect(runner.run(ingestion.id)).rejects.toThrow();

      const [, , failed] = await repository.segmentsOf(ingestion.id);

      expect(failed).toMatchObject({ status: "recognized", lastError: "save of segment 2 failed" });

      await runner.run(ingestion.id);

      const [, , recovered] = await repository.segmentsOf(ingestion.id);

      expect(recovered).toMatchObject({ status: "saved", lastError: null });
    });

    it("marks the Ingestion failed once every attempt is used, which frees the Account", async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        processor.failOnceAt("read", 0);
      }
      const ingestion = await service.start(accountId, threeSegments);

      for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
        await expect(runner.run(ingestion.id)).rejects.toThrow();
        expect(await repository.findById(ingestion.id)).toMatchObject({ status: "queued", attempts: attempt });
      }

      await expect(runner.run(ingestion.id)).rejects.toThrow();

      expect(await repository.findById(ingestion.id)).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
      await expect(service.start(accountId, threeSegments)).resolves.toMatchObject({ status: "queued" });
    });

    it("does nothing for an Ingestion that has already completed", async () => {
      const ingestion = await service.start(accountId, threeSegments);

      await runner.run(ingestion.id);
      processor.calls.length = 0;

      await runner.run(ingestion.id);

      expect(processor.calls).toEqual([]);
      expect(await repository.findById(ingestion.id)).toMatchObject({ status: "completed", attempts: 1 });
    });

    it("refuses an unknown Ingestion", async () => {
      await expect(runner.run(crypto.randomUUID())).rejects.toThrow("No Ingestion with the id");
    });
  });

  describe("progress", () => {
    it("is derived from the persisted Segment states", async () => {
      const ingestion = await service.start(accountId, threeSegments);
      const [first, second] = await repository.segmentsOf(ingestion.id);

      if (!first || !second) {
        throw new Error("Expected three segments");
      }

      await repository.recordStep(first.id, "read", { words: [] });
      await repository.recordStep(first.id, "recognize", { summary: "" });
      await repository.recordStep(first.id, "save", undefined);
      await repository.recordStep(second.id, "read", { words: [] });

      const progress = await service.progressOf(ingestion.id);

      expect(IngestionProgressSchema.safeParse(progress)).toMatchObject({ success: true });
      expect(progress).toEqual({
        ingestionId: ingestion.id,
        status: "queued",
        percentage: 44,
        segments: { total: 3, saved: 1 },
      });
    });
  });
});
