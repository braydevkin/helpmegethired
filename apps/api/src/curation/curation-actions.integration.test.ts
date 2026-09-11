import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ApiErrorSchema, CurationProgressStateSchema, SESSION_LIFETIME_SECONDS, type ApiError, type CurationProgress, type Id } from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { hashSessionToken } from "../auth/session-token";
import { SessionRepository } from "../auth/session.repository";
import { DATABASE, type Database } from "../database/database";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileService } from "../profile/profile.service";
import { QUEUE_PREFIX } from "../queue/queues";
import { CURATION_MAX_ATTEMPTS } from "./curation-job-options";
import { CurationQueue, type CurationJob } from "./curation-queue";
import { CURATION_RUNNER_SETTINGS } from "./curation-runner-settings";
import { CurationRunnerModule } from "./curation-runner.module";
import { CurationRunner } from "./curation.runner";
import { CurationModel, type CurationAnswer, type CurationCall } from "./model/curation-model";
import { FakeCurationModel, type FakeCurationOutcome } from "./model/fake-curation-model";
import { StatementRepository } from "./statement.repository";

const anyQuery = Array.from({ length: 1536 }, () => 1);

// The catalogue has one Model, so a Curation produced under another one is written directly.
const EARLIER_MODEL = "claude-sonnet-4";

type Action = "cancel" | "retry" | "rerun";

class RecordingCurationQueue extends CurationQueue {
  readonly jobs: CurationJob[] = [];

  enqueue(job: CurationJob): Promise<void> {
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

// The deterministic fake from #111, counting its calls, with a hook before each so a test can act
// while a unit is in flight.
class ObservedModel extends CurationModel {
  readonly calls: CurationCall[] = [];
  beforeCall: (callNumber: number) => Promise<void> = () => Promise.resolve();
  private fake = new FakeCurationModel();

  script(outcomes: readonly FakeCurationOutcome[]): void {
    this.fake = new FakeCurationModel(outcomes);
  }

  reset(): void {
    this.calls.length = 0;
    this.beforeCall = () => Promise.resolve();
    this.fake = new FakeCurationModel();
  }

  async generate(call: CurationCall): Promise<CurationAnswer> {
    this.calls.push(call);
    await this.beforeCall(this.calls.length);

    return this.fake.generate(call);
  }
}

describe("cancel, retry, and re-run a Curation", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: Database;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let profiles: ProfileService;
  let choices: ModelChoiceService;
  let runner: CurationRunner;
  let statements: StatementRepository;
  const queue = new RecordingCurationQueue();
  const model = new ObservedModel();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, CurationRunnerModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(CurationQueue)
      .useValue(queue)
      .overrideProvider(CurationModel)
      .useValue(model)
      .overrideProvider(CURATION_RUNNER_SETTINGS)
      .useValue({ unitConcurrency: 1 })
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    database = app.get(DATABASE);
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
    profiles = app.get(ProfileService);
    choices = app.get(ModelChoiceService);
    runner = app.get(CurationRunner);
    statements = app.get(StatementRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    model.reset();
  });

  const act = (action: Action, token?: string) =>
    fetch(`${baseUrl}/profile/curation/${action}`, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });

  const progressOf = async (response: Response): Promise<CurationProgress | null> => CurationProgressStateSchema.parse(await response.json()).progress;

  const errorOf = async (response: Response): Promise<ApiError> => ApiErrorSchema.parse(await response.json());

  const openSession = async (): Promise<{ accountId: Id; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });
    const token = randomUUID();

    await sessions.create({ accountId: account.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000) });

    return { accountId: account.id, token };
  };

  // A Profile as a completed Ingestion leaves it, not yet confirmed: two Experiences and a Project
  // whose descriptions the fake quotes, so every Statement's Evidence resolves.
  async function builtProfile(accountId: Id): Promise<void> {
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

    await database.insertInto("basic_profiles").values({ account_id: accountId, source_ingestion_id: ingestion.id, segment_id: segment.id, headline: "Platform Engineer" }).execute();
    await database
      .insertInto("experiences")
      .values([
        { ...rowOf(0), role: "Staff Engineer", company: "Parapet Systems", period_start: "2021-01", period_end: "2022-12", description: "Runs the platform.", skills: "[]" },
        { ...rowOf(1), role: "Engineer", company: "Parapet Systems", period_start: "2019-01", period_end: "2020-12", description: "Built the platform.", skills: "[]" },
      ])
      .execute();
    await database.insertInto("projects").values({ ...rowOf(0), name: "Ledger", description: "Settles payments overnight.", skills: "[]" }).execute();
  }

  const newestCurationOf = async (accountId: Id): Promise<Id> =>
    (await database.selectFrom("curations").select("id").where("account_id", "=", accountId).orderBy("created_at", "desc").orderBy("id", "desc").executeTakeFirstOrThrow()).id;

  // A confirmed Profile with a stored Model Key, which leaves a queued Curation (#112).
  const curated = async (): Promise<{ accountId: Id; token: string; curationId: Id }> => {
    const session = await openSession();

    await builtProfile(session.accountId);
    await choices.save(session.accountId, { provider: "anthropic", modelId: "claude-sonnet-5", key: `sk-ant-api03-candidate-${randomUUID()}` });
    await profiles.confirm(session.accountId);

    return { ...session, curationId: await newestCurationOf(session.accountId) };
  };

  const completed = async (): Promise<{ accountId: Id; token: string; curationId: Id }> => {
    const curation = await curated();

    await runner.run(curation.curationId);

    return curation;
  };

  const curationOf = (id: Id) => database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirstOrThrow();

  const statementsOf = (curationId: Id) => database.selectFrom("statements").select(["id", "embedding"]).where("curation_id", "=", curationId).orderBy("id").execute();

  const unitStatusesOf = async (curationId: Id) =>
    (await database.selectFrom("curation_units").select("status").where("curation_id", "=", curationId).orderBy("position").execute()).map((unit) => unit.status);

  const retrievedIds = async (accountId: Id): Promise<Id[]> => (await statements.nearest(accountId, anyQuery, 50)).map((statement) => statement.id).sort();

  const idsOf = (rows: readonly { id: Id }[]): Id[] => rows.map((row) => row.id).sort();

  const producedUnder = (curationId: Id, modelId: string) => database.updateTable("curations").set({ model_id: modelId }).where("id", "=", curationId).execute();

  const cancelOnCall = (callNumber: number, token: string): { response: () => Response | undefined } => {
    let response: Response | undefined;

    model.beforeCall = async (current) => {
      if (current === callNumber) {
        response = await act("cancel", token);
      }
    };

    return { response: () => response };
  };

  it("cancels a running Curation at the next unit boundary, keeping the saved Statements and indexing nothing", async () => {
    const { accountId, token, curationId } = await curated();
    const cancel = cancelOnCall(2, token);

    await runner.run(curationId);

    const response = cancel.response();

    expect(response?.status).toBe(200);
    expect(response && (await progressOf(response))).toMatchObject({ curationId, status: "cancelled" });
    expect(model.calls).toHaveLength(2);
    expect((await curationOf(curationId)).status).toBe("cancelled");

    const [first, ...rest] = await unitStatusesOf(curationId);

    expect(first).toBe("saved");
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((status) => status === "pending")).toBe(true);

    const saved = await statementsOf(curationId);

    expect(saved.length).toBeGreaterThan(0);
    expect(saved.every((statement) => statement.embedding === null)).toBe(true);
    expect(await retrievedIds(accountId)).toEqual([]);
  });

  it("retries a cancelled Curation from the first unsaved unit, calling the model for none already saved", async () => {
    const { accountId, token, curationId } = await curated();

    cancelOnCall(2, token);
    await runner.run(curationId);

    const savedBefore = await statementsOf(curationId);
    const units = (await unitStatusesOf(curationId)).length;

    model.reset();

    const retried = await act("retry", token);

    expect(retried.status).toBe(202);
    expect(await progressOf(retried)).toMatchObject({ curationId, status: "queued" });
    expect(queue.jobs.filter((job) => job.curationId === curationId)).toContainEqual({ curationId, maxAttempts: CURATION_MAX_ATTEMPTS });
    expect(await curationOf(curationId)).toMatchObject({ status: "queued", attempts: 0, failure_reason: null, resume_after: null });

    await runner.run(curationId);

    expect(model.calls).toHaveLength(units - 1);
    expect((await curationOf(curationId)).status).toBe("completed");

    const savedAfter = await statementsOf(curationId);

    expect(idsOf(savedAfter)).toEqual(expect.arrayContaining(idsOf(savedBefore)));
    expect(await retrievedIds(accountId)).toEqual(idsOf(savedAfter));
  });

  it("re-runs beside the current Curation, which stays retrievable until the new one completes and supersedes it", async () => {
    const { accountId, token, curationId: previous } = await completed();

    await producedUnder(previous, EARLIER_MODEL);

    const indexed = await retrievedIds(accountId);
    const rerun = await act("rerun", token);
    const next = await newestCurationOf(accountId);

    expect(rerun.status).toBe(202);
    expect(next).not.toBe(previous);
    expect(await progressOf(rerun)).toMatchObject({ curationId: next, status: "queued", percentage: 0 });
    expect(queue.jobs).toContainEqual({ curationId: next, maxAttempts: CURATION_MAX_ATTEMPTS });
    expect(indexed.length).toBeGreaterThan(0);
    expect(await retrievedIds(accountId)).toEqual(indexed);

    await runner.run(next);

    expect((await curationOf(previous)).status).toBe("superseded");
    expect(await statementsOf(previous)).toEqual([]);
    expect((await curationOf(next)).status).toBe("completed");
    expect(await retrievedIds(accountId)).toEqual(idsOf(await statementsOf(next)));
  });

  it("leaves the previous Curation current, indexed, and unchanged when a re-run fails", async () => {
    const { accountId, token, curationId: previous } = await completed();

    await producedUnder(previous, EARLIER_MODEL);

    const before = await statementsOf(previous);

    await act("rerun", token);

    const next = await newestCurationOf(accountId);

    model.script(["key_rejected"]);
    await runner.run(next);

    expect(await curationOf(next)).toMatchObject({ status: "failed", failure_reason: "model_key_rejected" });
    expect((await curationOf(previous)).status).toBe("completed");
    expect(await statementsOf(previous)).toEqual(before);
    expect(await retrievedIds(accountId)).toEqual(idsOf(before));
  });

  it("refuses a re-run of an unchanged completed Curation with a reason, and starts nothing", async () => {
    const { accountId, token, curationId } = await completed();

    const refused = await act("rerun", token);

    expect(refused.status).toBe(422);
    expect(await errorOf(refused)).toMatchObject({ statusCode: 422, code: "curation_unchanged" });
    expect(await newestCurationOf(accountId)).toBe(curationId);
  });

  it.each([
    ["the Model", { model_id: EARLIER_MODEL }],
    ["the prompt version", { prompt_version: "curation/0" }],
  ])("allows a re-run once %s changed since the current Curation was produced", async (_change, columns) => {
    const { accountId, token, curationId } = await completed();

    await database.updateTable("curations").set(columns).where("id", "=", curationId).execute();

    expect((await act("rerun", token)).status).toBe(202);
    expect(await newestCurationOf(accountId)).not.toBe(curationId);
  });

  it("leaves one Curation and one 409 when two starts race", async () => {
    const { accountId, token, curationId } = await completed();

    await producedUnder(curationId, EARLIER_MODEL);

    const responses = await Promise.all([act("rerun", token), act("rerun", token)]);
    const [conflict] = responses.filter((response) => response.status === 409);

    expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
    expect(conflict && (await errorOf(conflict)).code).toBe("curation_active");
    expect(await database.selectFrom("curations").select("id").where("account_id", "=", accountId).where("status", "in", ["queued", "running"]).execute()).toHaveLength(1);
  });

  it("answers 409 to a retry or a re-run while a Curation is queued", async () => {
    const { token } = await curated();

    for (const action of ["retry", "rerun"] as const) {
      const refused = await act(action, token);

      expect(refused.status).toBe(409);
      expect(await errorOf(refused)).toMatchObject({ code: "curation_active" });
    }
  });

  it("refuses to retry a completed Curation, or one started under another Model", async () => {
    const done = await completed();
    const notRetryable = await act("retry", done.token);

    expect(notRetryable.status).toBe(422);
    expect(await errorOf(notRetryable)).toMatchObject({ code: "curation_not_retryable" });

    const cancelled = await curated();

    await act("cancel", cancelled.token);
    await producedUnder(cancelled.curationId, EARLIER_MODEL);

    const changed = await act("retry", cancelled.token);

    expect(changed.status).toBe(422);
    expect(await errorOf(changed)).toMatchObject({ code: "curation_model_changed" });
    expect((await curationOf(cancelled.curationId)).status).toBe("cancelled");
  });

  it("answers 404 to a cancel with nothing queued or running, and leaves the Curation as it was", async () => {
    const { token, curationId } = await completed();

    const refused = await act("cancel", token);

    expect(refused.status).toBe(404);
    expect(await errorOf(refused)).toMatchObject({ code: "curation_not_found" });
    expect((await curationOf(curationId)).status).toBe("completed");
  });

  it("refuses a retry or a re-run before the Profile is confirmed and a Model Key stored", async () => {
    const { accountId, token } = await openSession();

    await builtProfile(accountId);

    for (const action of ["retry", "rerun"] as const) {
      const refused = await act(action, token);

      expect(refused.status).toBe(422);
      expect(await errorOf(refused)).toMatchObject({ code: "curation_not_ready" });
    }
  });

  it("never acts on another Account's Curation", async () => {
    const owner = await curated();
    const other = await openSession();

    expect((await act("cancel", other.token)).status).toBe(404);
    expect((await curationOf(owner.curationId)).status).toBe("queued");
  });

  it("refuses every action without a Session", async () => {
    for (const action of ["cancel", "retry", "rerun"] as const) {
      expect((await act(action)).status).toBe(401);
    }
  });
});
