import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id, IngestionProgress } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AccountRepository } from "../auth/account.repository";
import { AuthModule } from "../auth/auth.module";
import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { IngestionModule } from "./ingestion.module";
import { IngestionRepository } from "./ingestion.repository";
import { IngestionService } from "./ingestion.service";
import { ScriptedSegmentProcessor } from "./scripted-segment-processor.fixture";
import { SEGMENT_PROCESSORS } from "./segment-processor";

const COMPLETION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("profile ingestion through pg-boss", () => {
  let context: INestApplicationContext;
  let service: IngestionService;
  let repository: IngestionRepository;
  let processor: ScriptedSegmentProcessor;
  let accountId: Id;

  const untilSettled = async (ingestionId: Id): Promise<IngestionProgress> => {
    const deadline = Date.now() + COMPLETION_TIMEOUT_MS;

    for (;;) {
      const progress = await service.progressOf(ingestionId);

      if (progress.status === "completed" || progress.status === "failed" || Date.now() > deadline) {
        return progress;
      }

      await sleep(POLL_INTERVAL_MS);
    }
  };

  beforeAll(async () => {
    processor = new ScriptedSegmentProcessor().failOnceAt("recognize", 1);

    const moduleRef = await Test.createTestingModule({
      imports: [EnvironmentModule, DatabaseModule, AuthModule, IngestionModule],
    })
      .overrideProvider(SEGMENT_PROCESSORS)
      .useValue([processor])
      .compile();

    context = await moduleRef.init();
    service = context.get(IngestionService);
    repository = context.get(IngestionRepository);

    const account = await context.get(AccountRepository).create({
      email: `${crypto.randomUUID()}@candidate.example`,
    });

    accountId = account.id;
  });

  afterAll(async () => {
    await context.close();
  });

  it(
    "delivers the job to the worker, retries after a failure, and completes from where it stopped",
    async () => {
      const ingestion = await service.start(accountId, [
        { kind: "experience", input: { text: "first experience" } },
        { kind: "experience", input: { text: "second experience" } },
        { kind: "experience", input: { text: "third experience" } },
      ]);

      const progress = await untilSettled(ingestion.id);

      expect(progress).toMatchObject({ status: "completed", percentage: 100, segments: { total: 3, saved: 3 } });
      expect(await repository.findById(ingestion.id)).toMatchObject({ attempts: 2, lastError: null });
      expect(processor.callsFor("read")).toEqual([0, 1, 2]);
      expect(processor.callsFor("recognize")).toEqual([0, 1, 1, 2]);
      expect(processor.callsFor("save")).toEqual([0, 1, 2]);
    },
    COMPLETION_TIMEOUT_MS + 5_000,
  );
});
