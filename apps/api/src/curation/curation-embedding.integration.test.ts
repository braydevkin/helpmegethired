import { randomUUID } from "node:crypto";

import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id } from "@helpmegethired/shared";
import { sql } from "kysely";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileModule } from "../profile/profile.module";
import { ProfileService } from "../profile/profile.service";
import { QUEUE_PREFIX } from "../queue/queues";
import { CurationAttemptFailedError } from "./curation-errors";
import { CurationQueue } from "./curation-queue";
import { CURATION_RUNNER_SETTINGS } from "./curation-runner-settings";
import { CurationRunnerModule } from "./curation-runner.module";
import { CurationRunner } from "./curation.runner";
import { CurationModel, type CurationAnswer, type CurationCall } from "./model/curation-model";
import { EmbeddingFailedError, EmbeddingModel } from "./model/embedding-model";
import { FakeCurationModel, type FakeCurationOutcome } from "./model/fake-curation-model";
import { FakeEmbeddingModel } from "./model/fake-embedding-model";
import { StatementRepository } from "./statement.repository";

class ScriptedModel extends CurationModel {
  readonly calls: CurationCall[] = [];
  private fake = new FakeCurationModel();

  script(outcomes: readonly FakeCurationOutcome[]): void {
    this.fake = new FakeCurationModel(outcomes);
  }

  reset(): void {
    this.calls.length = 0;
    this.fake = new FakeCurationModel();
  }

  generate(call: CurationCall): Promise<CurationAnswer> {
    this.calls.push(call);

    return this.fake.generate(call);
  }
}

// The fake embedding model from #111, which can be told to fail its next call.
class ControllableEmbeddings extends EmbeddingModel {
  readonly batches: string[][] = [];
  failNext = false;
  private readonly fake = new FakeEmbeddingModel();

  embed(texts: readonly string[]): Promise<number[][]> {
    this.batches.push([...texts]);

    if (this.failNext) {
      this.failNext = false;

      return Promise.reject(new EmbeddingFailedError());
    }

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

describe("embedding and completing a Curation", () => {
  let context: INestApplicationContext;
  let database: Database;
  let runner: CurationRunner;
  let profiles: ProfileService;
  let choices: ModelChoiceService;
  let statements: StatementRepository;
  const model = new ScriptedModel();
  const embeddings = new ControllableEmbeddings();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileModule, CurationRunnerModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(CurationQueue)
      .useValue(new IdleQueue())
      .overrideProvider(CurationModel)
      .useValue(model)
      .overrideProvider(EmbeddingModel)
      .useValue(embeddings)
      .overrideProvider(CURATION_RUNNER_SETTINGS)
      .useValue({ unitConcurrency: 1 })
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    runner = context.get(CurationRunner);
    profiles = context.get(ProfileService);
    choices = context.get(ModelChoiceService);
    statements = context.get(StatementRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    model.reset();
    embeddings.batches.length = 0;
    embeddings.failNext = false;
    vi.restoreAllMocks();
  });

  const DESCRIPTIONS = ["Runs the deployment platform for forty teams.", "Cut the median pipeline from 22 to 9 minutes."];

  async function queuedCuration(accountId?: Id, descriptions: readonly string[] = DESCRIPTIONS): Promise<{ accountId: Id; curationId: Id }> {
    const owner =
      accountId ?? (await database.insertInto("accounts").values({ email: `${randomUUID()}@candidate.example` }).returning("id").executeTakeFirstOrThrow()).id;
    const { id: ingestionId } = await database
      .insertInto("ingestions")
      .values({ account_id: owner, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id: segmentId } = await database
      .insertInto("ingestion_segments")
      .values({ ingestion_id: ingestionId, position: 0, kind: "experience", status: "saved", input: "{}" })
      .returning("id")
      .executeTakeFirstOrThrow();

    await database.insertInto("basic_profiles").values({ account_id: owner, source_ingestion_id: ingestionId, segment_id: segmentId }).execute();

    for (const [position, description] of descriptions.entries()) {
      await database
        .insertInto("experiences")
        .values({ account_id: owner, source_ingestion_id: ingestionId, segment_id: segmentId, segment_position: 0, position, role: "Platform Engineer", company: `Company ${position}`, description, skills: "[]" })
        .execute();
    }

    await choices.save(owner, { provider: "anthropic", modelId: "claude-sonnet-5", key: `sk-ant-api03-candidate-${randomUUID()}` });
    await profiles.confirm(owner);

    const { id: curationId } = await database
      .selectFrom("curations")
      .select("id")
      .where("account_id", "=", owner)
      .where("status", "=", "queued")
      .executeTakeFirstOrThrow();

    return { accountId: owner, curationId };
  }

  const curationOf = (id: Id) => database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const vectorsOf = async (curationId: Id) =>
    (
      await database
        .selectFrom("statements")
        .select(["id", "text", sql<number | null>`vector_dims(embedding)`.as("dimensions")])
        .where("curation_id", "=", curationId)
        .execute()
    ).map((row) => row.dimensions);

  it("embeds every Statement at 1536 dimensions, in the transaction that writes completed", async () => {
    const { curationId } = await queuedCuration();

    await runner.run(curationId);

    const dimensions = await vectorsOf(curationId);

    expect(dimensions.length).toBeGreaterThan(0);
    expect(dimensions.every((count) => count === 1536)).toBe(true);
    expect(await curationOf(curationId)).toMatchObject({ status: "completed", failure_reason: null });
    expect(embeddings.batches).toHaveLength(1);
    expect(embeddings.batches[0]).toHaveLength(dimensions.length);
  });

  it("writes no vector while a unit is still unsaved", async () => {
    const { curationId } = await queuedCuration();
    model.script(["answer", "timeout"]);

    await expect(runner.run(curationId)).rejects.toBeInstanceOf(CurationAttemptFailedError);

    expect(embeddings.batches).toEqual([]);
    expect((await vectorsOf(curationId)).every((count) => count === null)).toBe(true);
  });

  it("leaves nothing indexed when embedding fails, and the retry embeds without calling the model again", async () => {
    const { curationId } = await queuedCuration();
    embeddings.failNext = true;

    await expect(runner.run(curationId)).rejects.toBeInstanceOf(CurationAttemptFailedError);

    expect(await curationOf(curationId)).toMatchObject({ status: "queued", attempts: 1 });
    expect((await vectorsOf(curationId)).every((count) => count === null)).toBe(true);

    model.reset();
    await runner.run(curationId);

    expect(model.calls).toEqual([]);
    expect(await curationOf(curationId)).toMatchObject({ status: "completed", attempts: 2 });
    expect((await vectorsOf(curationId)).every((count) => count === 1536)).toBe(true);
  });

  it("completes a Curation that wrote no Statement without calling the embedding model", async () => {
    const { curationId } = await queuedCuration(undefined, ["", ""]);

    await runner.run(curationId);

    expect(await vectorsOf(curationId)).toEqual([]);
    expect(embeddings.batches).toEqual([]);
    expect((await curationOf(curationId)).status).toBe("completed");
  });

  it("treats an answer missing a vector as an embedding failure, indexing nothing", async () => {
    const { curationId } = await queuedCuration();
    vi.spyOn(embeddings, "embed").mockResolvedValueOnce([]);

    await expect(runner.run(curationId)).rejects.toBeInstanceOf(CurationAttemptFailedError);

    expect(await curationOf(curationId)).toMatchObject({ status: "queued", attempts: 1 });
    expect((await vectorsOf(curationId)).every((count) => count === null)).toBe(true);
  });

  it("indexes nothing for a Curation cancelled while its Statements were being embedded", async () => {
    const { curationId } = await queuedCuration();
    const embed = embeddings.embed.bind(embeddings);
    vi.spyOn(embeddings, "embed").mockImplementation(async (texts) => {
      await database.updateTable("curations").set({ status: "cancelled" }).where("id", "=", curationId).execute();

      return embed(texts);
    });

    await expect(runner.run(curationId)).resolves.toBeUndefined();

    expect((await curationOf(curationId)).status).toBe("cancelled");
    expect((await vectorsOf(curationId)).every((count) => count === null)).toBe(true);
  });

  describe("retrieval", () => {
    const queryFor = async (text: string) => (await new FakeEmbeddingModel().embed([text]))[0] ?? [];

    it("answers the Account's nearest Statements of its current Curation, the closest first", async () => {
      const { accountId, curationId } = await queuedCuration();
      await runner.run(curationId);
      const [target] = await database.selectFrom("statements").select(["id", "text"]).where("curation_id", "=", curationId).orderBy("id").execute();

      const nearest = await statements.nearest(accountId, await queryFor(target!.text), 3);

      expect(nearest[0]?.id).toBe(target?.id);
      expect(nearest.length).toBeLessThanOrEqual(3);
    });

    it("never answers a rejected Statement", async () => {
      const { accountId, curationId } = await queuedCuration();
      await runner.run(curationId);
      const [target] = await database.selectFrom("statements").select(["id", "text"]).where("curation_id", "=", curationId).orderBy("id").execute();
      await database.updateTable("statements").set({ review_state: "rejected", reviewed_at: new Date() }).where("id", "=", target!.id).execute();

      const nearest = await statements.nearest(accountId, await queryFor(target!.text), 10);

      expect(nearest.map((statement) => statement.id)).not.toContain(target?.id);
    });

    it("reads only the current Curation, the latest completed one", async () => {
      const { accountId, curationId } = await queuedCuration();
      await runner.run(curationId);
      await database.updateTable("curations").set({ status: "superseded" }).where("id", "=", curationId).execute();
      const { curationId: currentId } = await queuedCuration(accountId);
      await runner.run(currentId);

      const nearest = await statements.nearest(accountId, await queryFor("Runs the deployment platform for forty teams."), 50);
      const curationsAnswered = await database
        .selectFrom("statements")
        .select("curation_id")
        .where("id", "in", nearest.map((statement) => statement.id))
        .execute();

      expect(nearest.length).toBeGreaterThan(0);
      expect(new Set(curationsAnswered.map((row) => row.curation_id))).toEqual(new Set([currentId]));
    });

    it("never crosses an Account", async () => {
      const pair = await createAccountPair(database);
      const { curationId } = await queuedCuration(pair.owner);
      await runner.run(curationId);
      const query = await queryFor("Runs the deployment platform for forty teams.");

      await expectScopedToAccount(pair, async (accountId) => {
        const found = await statements.nearest(accountId, query, 5);

        return found.length > 0 ? found : undefined;
      });
    });
  });
});
