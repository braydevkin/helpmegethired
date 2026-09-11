import { randomUUID } from "node:crypto";

import { Logger, type INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id } from "@helpmegethired/shared";
import type { Queue } from "bullmq";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { ModelChoiceModule } from "../model-choice/model-choice.module";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileModule } from "../profile/profile.module";
import { ProfileService } from "../profile/profile.service";
import { QueueModule } from "../queue/queue.module";
import { PROFILE_CURATION_QUEUE, QUEUE_PREFIX } from "../queue/queues";
import { BullMqCurationQueue } from "./bullmq-curation.queue";
import { CURATION_MAX_ATTEMPTS } from "./curation-job-options";
import { CurationQueue, type CurationJob } from "./curation-queue";
import { CURATION_PROMPT_VERSION } from "./curation-starter";
import { CurationRepository } from "./curation.repository";

class RecordingCurationQueue extends CurationQueue {
  readonly jobs: CurationJob[] = [];
  unavailable = false;

  enqueue(job: CurationJob): Promise<void> {
    if (this.unavailable) {
      return Promise.reject(new Error("Redis is unreachable"));
    }

    this.jobs.push(job);

    return Promise.resolve();
  }

  work(): Promise<void> {
    return Promise.resolve();
  }

  hasPendingJob(curationId: Id): Promise<boolean> {
    return Promise.resolve(this.jobs.some((job) => job.curationId === curationId));
  }
}

const modelKey = () => `sk-ant-api03-candidate-${randomUUID()}`;
const choiceWith = (key: string) => ({ provider: "anthropic", modelId: "claude-sonnet-5", key }) as const;

describe("starting a Curation", () => {
  let context: INestApplicationContext;
  let database: Database;
  let profiles: ProfileService;
  let choices: ModelChoiceService;
  let repository: CurationRepository;
  let queue: RecordingCurationQueue;

  beforeAll(async () => {
    queue = new RecordingCurationQueue();

    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileModule, ModelChoiceModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(CurationQueue)
      .useValue(queue)
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    profiles = context.get(ProfileService);
    choices = context.get(ModelChoiceService);
    repository = context.get(CurationRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    queue.unavailable = false;
    vi.restoreAllMocks();
  });

  const newAccount = async (): Promise<Id> =>
    (await database.insertInto("accounts").values({ email: `${randomUUID()}@candidate.example` }).returning("id").executeTakeFirstOrThrow()).id;

  // A Profile as a completed Ingestion leaves it: a Basic Profile, and the Experiences and
  // Projects the units are derived from.
  async function builtProfile(accountId: Id, { experiences, projects }: { experiences: number; projects: number }): Promise<Id> {
    const ingestion = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    const segment = await database
      .insertInto("ingestion_segments")
      .values({ ingestion_id: ingestion.id, position: 0, kind: "experience", status: "saved", input: "{}" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const rowOf = (position: number) => ({ account_id: accountId, source_ingestion_id: ingestion.id, segment_id: segment.id, segment_position: 0, position });

    await database
      .insertInto("basic_profiles")
      .values({ account_id: accountId, source_ingestion_id: ingestion.id, segment_id: segment.id, headline: "Platform Engineer" })
      .execute();

    for (let position = 0; position < experiences; position += 1) {
      await database
        .insertInto("experiences")
        .values({ ...rowOf(position), role: `Role ${position}`, company: "Parapet Systems", period_start: "2020-01", period_end: null, description: "Runs the platform.", skills: "[]" })
        .execute();
    }

    for (let position = 0; position < projects; position += 1) {
      await database.insertInto("projects").values({ ...rowOf(position), name: `Project ${position}`, skills: "[]" }).execute();
    }

    return ingestion.id;
  }

  const curationsOf = (accountId: Id) => database.selectFrom("curations").selectAll().where("account_id", "=", accountId).orderBy("created_at").execute();

  const unitsOf = (curationId: Id) =>
    database.selectFrom("curation_units").select(["kind", "position", "subject_id", "title"]).where("curation_id", "=", curationId).orderBy("position").execute();

  const jobsFor = (accountId: Id) => curationsOf(accountId).then((rows) => queue.jobs.filter((job) => rows.some((row) => row.id === job.curationId)));

  it("creates nothing on a confirm with no Model Key, then one Curation with its units when the key is stored", async () => {
    const accountId = await newAccount();
    const ingestionId = await builtProfile(accountId, { experiences: 2, projects: 1 });

    expect((await profiles.confirm(accountId)).confirmedAt).not.toBeNull();
    expect(await curationsOf(accountId)).toEqual([]);

    await choices.save(accountId, choiceWith(modelKey()));

    const [curation, ...others] = await curationsOf(accountId);

    expect(others).toEqual([]);
    expect(curation).toMatchObject({
      status: "queued",
      attempts: 0,
      max_attempts: CURATION_MAX_ATTEMPTS,
      source_ingestion_id: ingestionId,
      model_id: "claude-sonnet-5",
      prompt_version: CURATION_PROMPT_VERSION,
    });
    expect((await unitsOf(curation!.id)).map((unit) => [unit.kind, unit.position, unit.title])).toEqual([
      ["experience", 0, "Role 0 at Parapet Systems"],
      ["experience", 1, "Role 1 at Parapet Systems"],
      ["project", 2, "Project 0"],
      ["cross_cutting", 3, "Competences that appear in more than one place"],
      ["synthesis", 4, "The whole career, read together"],
    ]);
    expect(await jobsFor(accountId)).toEqual([{ curationId: curation!.id, maxAttempts: CURATION_MAX_ATTEMPTS }]);
  });

  it("creates it on the confirm when the key came first, and never again however often confirm repeats", async () => {
    const accountId = await newAccount();
    await builtProfile(accountId, { experiences: 1, projects: 0 });

    await choices.save(accountId, choiceWith(modelKey()));
    expect(await curationsOf(accountId)).toEqual([]);

    const first = await profiles.confirm(accountId);
    const second = await profiles.confirm(accountId);

    expect(second.confirmedAt).toBe(first.confirmedAt);
    expect(await curationsOf(accountId)).toHaveLength(1);
    expect(await jobsFor(accountId)).toHaveLength(1);
  });

  it("creates no second Curation when the key is replaced on a Profile that already has one", async () => {
    const accountId = await newAccount();
    await builtProfile(accountId, { experiences: 1, projects: 1 });
    await choices.save(accountId, choiceWith(modelKey()));
    await profiles.confirm(accountId);

    await choices.save(accountId, choiceWith(modelKey()));
    await choices.save(accountId, choiceWith(modelKey()));

    expect(await curationsOf(accountId)).toHaveLength(1);
    expect(await jobsFor(accountId)).toHaveLength(1);
  });

  it.each([
    ["no Project", { experiences: 3, projects: 0 }, ["experience", "experience", "experience", "cross_cutting", "synthesis"]],
    ["twenty Experiences", { experiences: 20, projects: 2 }, [...Array<string>(20).fill("experience"), "project", "project", "cross_cutting", "synthesis"]],
  ])("derives exactly the Profile's units for a Profile with %s", async (_label, shape, kinds) => {
    const accountId = await newAccount();
    await builtProfile(accountId, shape);
    await choices.save(accountId, choiceWith(modelKey()));
    await profiles.confirm(accountId);

    const [curation] = await curationsOf(accountId);

    expect((await unitsOf(curation!.id)).map((unit) => unit.kind)).toEqual(kinds);
  });

  it("rolls the confirmation back when the units cannot be written", async () => {
    const accountId = await newAccount();
    const ingestionId = await builtProfile(accountId, { experiences: 1, projects: 0 });
    await choices.save(accountId, choiceWith(modelKey()));
    vi.spyOn(repository, "create").mockRejectedValueOnce(new Error("the units could not be written"));

    await expect(profiles.confirm(accountId)).rejects.toThrow("the units could not be written");

    const basicProfile = await database.selectFrom("basic_profiles").select("confirmed_at").where("source_ingestion_id", "=", ingestionId).executeTakeFirstOrThrow();
    expect(basicProfile.confirmed_at).toBeNull();
    expect(await curationsOf(accountId)).toEqual([]);
  });

  it("rolls the stored key back when the Curation cannot be written", async () => {
    const accountId = await newAccount();
    await builtProfile(accountId, { experiences: 1, projects: 0 });
    await profiles.confirm(accountId);
    vi.spyOn(repository, "create").mockRejectedValueOnce(new Error("the units could not be written"));

    await expect(choices.save(accountId, choiceWith(modelKey()))).rejects.toThrow("the units could not be written");

    expect((await choices.get(accountId)).choice).toBeNull();
  });

  it("confirms and leaves the Curation queued when the queue is unreachable, for reconciliation to pick up", async () => {
    const accountId = await newAccount();
    await builtProfile(accountId, { experiences: 1, projects: 0 });
    await choices.save(accountId, choiceWith(modelKey()));
    queue.unavailable = true;
    const logged = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    await expect(profiles.confirm(accountId)).resolves.toMatchObject({ confirmedAt: expect.any(String) });

    const [curation] = await curationsOf(accountId);
    expect(curation?.status).toBe("queued");
    expect(await jobsFor(accountId)).toEqual([]);
    expect(logged).toHaveBeenCalledWith(`Curation ${curation?.id} is queued but its job could not be added`, expect.any(Error));
  });

  it("lets a failed Curation of the Profile give way to a new one on the next confirm", async () => {
    const accountId = await newAccount();
    await builtProfile(accountId, { experiences: 1, projects: 0 });
    await choices.save(accountId, choiceWith(modelKey()));
    await profiles.confirm(accountId);
    await database.updateTable("curations").set({ status: "failed", failure_reason: "attempts_exhausted" }).where("account_id", "=", accountId).execute();

    await profiles.confirm(accountId);

    expect((await curationsOf(accountId)).map((curation) => curation.status)).toEqual(["failed", "queued"]);
  });

  it("reads another Account's readiness and Curations as absent", async () => {
    const pair = await createAccountPair(database);
    const ingestionId = await builtProfile(pair.owner, { experiences: 1, projects: 0 });
    await choices.save(pair.owner, choiceWith(modelKey()));
    await profiles.confirm(pair.owner);

    await expectScopedToAccount(pair, (accountId) => repository.readinessOf(accountId));
    await expectScopedToAccount(pair, (accountId) => repository.findCurrentFor(accountId, ingestionId));
    await expectScopedToAccount(pair, (accountId) => repository.findActive(accountId));
    await expectScopedToAccount(pair, async (accountId) => {
      const { experiences } = await repository.subjectsOf(accountId, ingestionId);

      return experiences.length > 0 ? experiences : undefined;
    });

    await choices.save(pair.other, choiceWith(modelKey()));
    expect(await curationsOf(pair.other)).toEqual([]);
  });
});

describe("the profile-curation queue", () => {
  let context: INestApplicationContext;
  let bullQueue: Queue<CurationJob>;
  let curationQueue: BullMqCurationQueue;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, QueueModule], providers: [BullMqCurationQueue] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .compile();

    context = await moduleRef.init();
    bullQueue = context.get(PROFILE_CURATION_QUEUE);
    curationQueue = context.get(BullMqCurationQueue);
  });

  afterAll(async () => {
    await bullQueue.obliterate({ force: true });
    await context.close();
  });

  it("keys the job by the Curation id, so adding it twice adds one job", async () => {
    const job = { curationId: randomUUID(), maxAttempts: CURATION_MAX_ATTEMPTS };

    await curationQueue.enqueue(job);
    await curationQueue.enqueue(job);

    expect((await bullQueue.getJob(job.curationId))?.data).toEqual(job);
    expect(await bullQueue.getJobCounts("waiting", "prioritized", "delayed")).toMatchObject({ waiting: 1 });
    expect(await curationQueue.hasPendingJob(job.curationId)).toBe(true);
  });
});
