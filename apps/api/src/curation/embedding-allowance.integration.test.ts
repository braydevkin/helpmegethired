import { randomUUID } from "node:crypto";

import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id } from "@helpmegethired/shared";
import { sql } from "kysely";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Clock } from "../common/clock";
import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileModule } from "../profile/profile.module";
import { ProfileService } from "../profile/profile.service";
import { QUEUE_PREFIX } from "../queue/queues";
import { CurationQueue } from "./curation-queue";
import { CURATION_RUNNER_SETTINGS } from "./curation-runner-settings";
import { CurationRunnerModule } from "./curation-runner.module";
import { CurationRunner } from "./curation.runner";
import { DEFAULT_DAILY_EMBEDDING_TOKENS, embeddingPeriodOf, nextEmbeddingPeriodOf } from "./embedding-allowance";
import { EmbeddingAllowanceRepository } from "./embedding-allowance.repository";
import { EmbeddingModel } from "./model/embedding-model";
import { FakeEmbeddingModel } from "./model/fake-embedding-model";

const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = "2026-09-11";
const TOMORROW = "2026-09-12";

class MovableClock extends Clock {
  at: Date | undefined;

  now(): Date {
    return this.at ?? new Date();
  }
}

class RecordingEmbeddings extends EmbeddingModel {
  readonly batches: string[][] = [];
  private readonly fake = new FakeEmbeddingModel();

  embed(texts: readonly string[]): Promise<number[][]> {
    this.batches.push([...texts]);

    return this.fake.embed(texts);
  }
}

class IdleQueue extends CurationQueue {
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

describe("the per-Account embedding ceiling", () => {
  let context: INestApplicationContext;
  let database: Database;
  let runner: CurationRunner;
  let allowance: EmbeddingAllowanceRepository;
  let profiles: ProfileService;
  let choices: ModelChoiceService;
  const clock = new MovableClock();
  const embeddings = new RecordingEmbeddings();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileModule, CurationRunnerModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(CurationQueue)
      .useValue(new IdleQueue())
      .overrideProvider(EmbeddingModel)
      .useValue(embeddings)
      .overrideProvider(Clock)
      .useValue(clock)
      .overrideProvider(CURATION_RUNNER_SETTINGS)
      .useValue({ unitConcurrency: 1 })
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    runner = context.get(CurationRunner);
    allowance = context.get(EmbeddingAllowanceRepository);
    profiles = context.get(ProfileService);
    choices = context.get(ModelChoiceService);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    clock.at = undefined;
    embeddings.batches.length = 0;
  });

  const newAccount = async (): Promise<Id> =>
    (await database.insertInto("accounts").values({ email: `${randomUUID()}@candidate.example` }).returning("id").executeTakeFirstOrThrow()).id;

  const overrideCeiling = (accountId: Id, tokensPerDay: number) =>
    database.insertInto("embedding_ceiling_overrides").values({ account_id: accountId, tokens_per_day: tokensPerDay }).execute();

  const curationOf = (id: Id) => database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  async function queuedCuration(accountId: Id): Promise<Id> {
    const { id: ingestionId } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id: segmentId } = await database
      .insertInto("ingestion_segments")
      .values({ ingestion_id: ingestionId, position: 0, kind: "experience", status: "saved", input: "{}" })
      .returning("id")
      .executeTakeFirstOrThrow();

    await database.insertInto("basic_profiles").values({ account_id: accountId, source_ingestion_id: ingestionId, segment_id: segmentId }).execute();
    await database
      .insertInto("experiences")
      .values({
        account_id: accountId,
        source_ingestion_id: ingestionId,
        segment_id: segmentId,
        segment_position: 0,
        position: 0,
        role: "Platform Engineer",
        company: "Company 0",
        description: "Runs the deployment platform for forty teams.",
        skills: "[]",
      })
      .execute();
    await choices.save(accountId, { provider: "anthropic", modelId: "claude-sonnet-5", key: `sk-ant-api03-candidate-${randomUUID()}` });
    await profiles.confirm(accountId);

    return (
      await database
        .selectFrom("curations")
        .select("id")
        .where("account_id", "=", accountId)
        .where("source_ingestion_id", "=", ingestionId)
        .executeTakeFirstOrThrow()
    ).id;
  }

  describe("reservations", () => {
    it("counts reservations up to the ceiling and refuses the one that would pass it", async () => {
      const accountId = await newAccount();
      await overrideCeiling(accountId, 100);

      expect(await allowance.reserve(accountId, 60, TODAY)).toBe(true);
      expect(await allowance.reserve(accountId, 50, TODAY)).toBe(false);
      expect(await allowance.reserve(accountId, 40, TODAY)).toBe(true);
      expect(await allowance.usedIn(accountId, TODAY)).toBe(100);
    });

    it("never passes the ceiling however many reservations race for it", async () => {
      const accountId = await newAccount();
      await overrideCeiling(accountId, 100);

      const reserved = await Promise.all(Array.from({ length: 10 }, () => allowance.reserve(accountId, 15, TODAY)));

      expect(reserved.filter(Boolean)).toHaveLength(6);
      expect(await allowance.usedIn(accountId, TODAY)).toBe(90);
    });

    it("keeps the counter in the database, so a worker that restarts reads the same figure", async () => {
      const accountId = await newAccount();
      await allowance.reserve(accountId, 1234, TODAY);

      expect(await new EmbeddingAllowanceRepository(database).usedIn(accountId, TODAY)).toBe(1234);
    });

    it("raises the ceiling for the Account an override names, and for no other", async () => {
      const raised = await newAccount();
      const other = await newAccount();
      await overrideCeiling(raised, DEFAULT_DAILY_EMBEDDING_TOKENS * 2);

      expect(await allowance.reserve(raised, DEFAULT_DAILY_EMBEDDING_TOKENS + 1, TODAY)).toBe(true);
      expect(await allowance.reserve(other, DEFAULT_DAILY_EMBEDDING_TOKENS + 1, TODAY)).toBe(false);
    });

    it("starts every UTC day at zero", async () => {
      const accountId = await newAccount();
      await overrideCeiling(accountId, 100);

      expect(await allowance.reserve(accountId, 100, TODAY)).toBe(true);
      expect(await allowance.reserve(accountId, 1, TODAY)).toBe(false);
      expect(await allowance.reserve(accountId, 1, TOMORROW)).toBe(true);
    });
  });

  describe("a Curation at the ceiling", () => {
    it("is paused before any embedding call, with its reason, the next UTC midnight, and its attempt kept", async () => {
      clock.at = new Date();
      const accountId = await newAccount();
      const curationId = await queuedCuration(accountId);
      await database.insertInto("embedding_usage").values({ account_id: accountId, period_start: embeddingPeriodOf(clock.at), tokens: DEFAULT_DAILY_EMBEDDING_TOKENS }).execute();

      await runner.run(curationId);

      expect(embeddings.batches).toEqual([]);
      expect(await curationOf(curationId)).toMatchObject({
        status: "queued",
        attempts: 0,
        pause_reason: "embedding_ceiling",
        resume_after: nextEmbeddingPeriodOf(clock.at),
      });
      expect(await database.selectFrom("curation_units").select("status").where("curation_id", "=", curationId).execute()).toEqual([
        { status: "saved" },
        { status: "saved" },
        { status: "saved" },
      ]);
    });

    it("completes once the next period starts, embedding without calling the model again", async () => {
      clock.at = new Date();
      const accountId = await newAccount();
      const curationId = await queuedCuration(accountId);
      await database.insertInto("embedding_usage").values({ account_id: accountId, period_start: embeddingPeriodOf(clock.at), tokens: DEFAULT_DAILY_EMBEDDING_TOKENS }).execute();
      await runner.run(curationId);

      clock.at = new Date(clock.at.getTime() + DAY_MS);
      await database.updateTable("curations").set({ resume_after: sql<Date>`now() - interval '1 second'` }).where("id", "=", curationId).execute();
      await runner.run(curationId);

      expect(await curationOf(curationId)).toMatchObject({ status: "completed", pause_reason: null, resume_after: null });
      expect(embeddings.batches).toHaveLength(1);
      expect(await allowance.usedIn(accountId, embeddingPeriodOf(clock.at))).toBeGreaterThan(0);
    });

    it("cannot be passed by starting another Curation", async () => {
      clock.at = new Date();
      const period = embeddingPeriodOf(clock.at);
      const accountId = await newAccount();
      const first = await queuedCuration(accountId);
      await runner.run(first);
      const spent = await allowance.usedIn(accountId, period);
      await overrideCeiling(accountId, spent + Math.floor(spent / 2));

      const second = await queuedCuration(accountId);
      await runner.run(second);

      expect((await curationOf(first)).status).toBe("completed");
      expect(await curationOf(second)).toMatchObject({ status: "queued", pause_reason: "embedding_ceiling" });
      expect(embeddings.batches).toHaveLength(1);
      expect(await allowance.usedIn(accountId, period)).toBe(spent);
    });
  });
});
