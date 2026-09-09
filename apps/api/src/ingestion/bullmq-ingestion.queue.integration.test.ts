import { randomUUID } from "node:crypto";

import type { INestApplicationContext, ModuleMetadata } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id, IngestionProgress } from "@helpmegethired/shared";
import { Worker, type ConnectionOptions, type Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AccountRepository } from "../auth/account.repository";
import { AuthModule } from "../auth/auth.module";
import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { CONSUMER_CONNECTION, PROFILE_INGESTION_QUEUE, QUEUE_PREFIX } from "../queue/queues";
import { WorkerModule } from "../worker/worker.module";
import { INGESTION_JOB_NAME } from "./ingestion-job-options";
import { type IngestionJob } from "./ingestion-queue";
import { WORKER_SETTINGS } from "../queue/worker-settings";
import { IngestionModule } from "./ingestion.module";
import { IngestionRepository } from "./ingestion.repository";
import { IngestionRunner } from "./ingestion.runner";
import { IngestionService } from "./ingestion.service";
import { ScriptedSegmentProcessor } from "./scripted-segment-processor.fixture";
import { SEGMENT_PROCESSORS } from "./segment-processor";

const SETTLE_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;
const LOCK_DURATION_MS = 1_000;
const STALLED_INTERVAL_MS = 500;

const threeSegments = ["first experience", "second experience", "third experience"].map((text) => ({
  kind: "scripted",
  input: { text },
}));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition: () => Promise<boolean> | boolean): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;

  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the queue");
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

describe("profile ingestion through BullMQ", () => {
  const prefix = `test-${randomUUID()}`;
  const processor = new ScriptedSegmentProcessor();
  const consumers: INestApplicationContext[] = [];
  let producer: INestApplicationContext;
  let service: IngestionService;
  let repository: IngestionRepository;
  let accountId: Id;

  const build = async (imports: ModuleMetadata["imports"]) => {
    const moduleRef = await Test.createTestingModule({ imports })
      .overrideProvider(SEGMENT_PROCESSORS)
      .useValue([processor])
      .overrideProvider(QUEUE_PREFIX)
      .useValue(prefix)
      .overrideProvider(WORKER_SETTINGS)
      .useValue({ concurrency: 1, lockDurationMs: LOCK_DURATION_MS, stalledIntervalMs: STALLED_INTERVAL_MS })
      .compile();

    return moduleRef.init();
  };

  const startConsumer = async (): Promise<void> => {
    consumers.push(await build([WorkerModule]));
  };

  const settledProgress = async (ingestionId: Id): Promise<IngestionProgress> => {
    let progress = await service.progressOf(accountId, ingestionId);

    await until(async () => {
      progress = await service.progressOf(accountId, ingestionId);

      return progress.status === "completed" || progress.status === "failed";
    });

    return progress;
  };

  beforeAll(async () => {
    producer = await build([EnvironmentModule, DatabaseModule, AuthModule, IngestionModule]);
    service = producer.get(IngestionService);
    repository = producer.get(IngestionRepository);
  });

  beforeEach(async () => {
    const account = await producer.get(AccountRepository).create({ email: `${randomUUID()}@candidate.example` });

    accountId = account.id;
    processor.calls.length = 0;
  });

  afterEach(async () => {
    await Promise.all(consumers.splice(0).map((consumer) => consumer.close()));
  });

  afterAll(async () => {
    await producer.get<Queue>(PROFILE_INGESTION_QUEUE).obliterate({ force: true });
    await producer.close();
  });

  it("delivers the job to the worker, retries after a failure, and completes from where it stopped", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    processor.failOnceAt("recognize", 1);
    await startConsumer();

    const ingestion = await service.start({ accountId, source: "upload", segments: threeSegments });

    expect(await settledProgress(ingestion.id)).toMatchObject({
      status: "completed",
      percentage: 100,
      segments: { total: 3, saved: 3 },
    });
    expect(await repository.findById(accountId, ingestion.id)).toMatchObject({ attempts: 2, lastError: null });
    expect(processor.callsFor("read")).toEqual([0, 1, 2]);
    expect(processor.callsFor("recognize")).toEqual([0, 1, 1, 2]);
    expect(processor.callsFor("save")).toEqual([0, 1, 2]);
  });

  it("re-delivers the job of a worker that died mid-run and resumes from the first incomplete Segment", { timeout: SETTLE_TIMEOUT_MS }, async () => {
    processor.hangOnceAt("recognize", 1);
    // A worker's first stalled check claims the queue's check for its whole interval, and the
    // default is 30 seconds; the dying worker must leave the claim to the consumer that follows.
    const dying = new Worker<IngestionJob>(
      producer.get<Queue>(PROFILE_INGESTION_QUEUE).name,
      (job) => producer.get(IngestionRunner).run(job.data.ingestionId),
      {
        connection: producer.get<ConnectionOptions>(CONSUMER_CONNECTION),
        prefix,
        lockDuration: LOCK_DURATION_MS,
        skipStalledCheck: true,
      },
    );
    dying.on("error", () => undefined);

    const ingestion = await service.start({ accountId, source: "upload", segments: threeSegments });

    await until(() => processor.hasReached("recognize", 1));
    await dying.close(true);
    await startConsumer();

    expect(await settledProgress(ingestion.id)).toMatchObject({ status: "completed", percentage: 100 });
    expect(await repository.findById(accountId, ingestion.id)).toMatchObject({ attempts: 2, lastError: null });
    expect(processor.callsFor("read")).toEqual([0, 1, 2]);
    expect(processor.callsFor("recognize")).toEqual([0, 1, 1, 2]);
    expect(processor.callsFor("save")).toEqual([0, 1, 2]);
  });

  it("adds one job per Ingestion, named for the run and identified by the Ingestion id", async () => {
    const ingestion = await service.start({ accountId, source: "upload", segments: threeSegments });
    const job = await producer.get<Queue>(PROFILE_INGESTION_QUEUE).getJob(ingestion.id);

    expect(job).toMatchObject({ name: INGESTION_JOB_NAME, data: { ingestionId: ingestion.id, maxAttempts: 3 } });
    expect(job?.opts).toMatchObject({ attempts: 3, removeOnFail: false });
  });
});
