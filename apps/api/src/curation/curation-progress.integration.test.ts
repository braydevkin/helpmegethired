import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  CurationProgressStateSchema,
  SESSION_LIFETIME_SECONDS,
  type CurationFailureReason,
  type CurationProgressState,
  type CurationStatus,
  type CurationUnitStatus,
  type Id,
} from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { SessionRepository } from "../auth/session.repository";
import { hashSessionToken } from "../auth/session-token";
import { DATABASE, type Database } from "../database/database";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { QUEUE_PREFIX } from "../queue/queues";
import { CurationProgressService } from "./curation-progress.service";

const MODEL_ID = "claude-sonnet-5";
const DAY_MS = 24 * 60 * 60 * 1000;

interface SeededCuration {
  status?: CurationStatus;
  units?: CurationUnitStatus[];
  failureReason?: CurationFailureReason | null;
  resumeAfter?: Date | null;
}

async function startedApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(QUEUE_PREFIX)
    .useValue(`test-${randomUUID()}`)
    .compile();
  const app = moduleRef.createNestApplication();

  await app.listen(0);

  return app;
}

describe("GET /profile/curation", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: Database;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let service: CurationProgressService;

  beforeAll(async () => {
    app = await startedApp();
    baseUrl = await app.getUrl();
    database = app.get(DATABASE);
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
    service = app.get(CurationProgressService);
  });

  afterAll(async () => {
    await app.close();
  });

  const request = (path: string, token?: string, headers: Record<string, string> = {}, url = baseUrl) =>
    fetch(`${url}${path}`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers } });

  const poll = (token: string, headers: Record<string, string> = {}, url = baseUrl) => request("/profile/curation", token, headers, url);

  const stateOf = async (response: Response): Promise<CurationProgressState> => CurationProgressStateSchema.parse(await response.json());

  const openSession = async (): Promise<{ accountId: Id; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });
    const token = randomUUID();

    await sessions.create({
      accountId: account.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
    });

    return { accountId: account.id, token };
  };

  // A Profile as a completed Ingestion leaves it: two roles at one company with closed periods,
  // so the metrics do not move with the clock, and one Project.
  async function builtProfile(accountId: Id, completedAt = new Date()): Promise<Id> {
    const ingestion = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: completedAt })
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
      .values({ account_id: accountId, source_ingestion_id: ingestion.id, segment_id: segment.id, headline: "Platform Engineer", confirmed_at: completedAt })
      .execute();
    await database
      .insertInto("experiences")
      .values([
        { ...rowOf(0), role: "Staff Engineer", company: "Parapet Systems", period_start: "2021-01", period_end: "2022-12", description: "Runs the platform.", skills: "[]" },
        { ...rowOf(1), role: "Engineer", company: "Parapet Systems", period_start: "2019-01", period_end: "2020-12", description: "Built the platform.", skills: "[]" },
      ])
      .execute();
    await database.insertInto("projects").values({ ...rowOf(0), name: "Ledger", skills: "[]" }).execute();

    return ingestion.id;
  }

  async function curationOf(accountId: Id, ingestionId: Id, seeded: SeededCuration = {}): Promise<Id> {
    const { status = "running", units = ["saved", "running", "pending", "pending"], failureReason = null, resumeAfter = null } = seeded;
    const { id } = await database
      .insertInto("curations")
      .values({
        account_id: accountId,
        source_ingestion_id: ingestionId,
        status,
        attempts: 1,
        max_attempts: 3,
        prompt_version: "curation/1",
        model_id: MODEL_ID,
        failure_reason: failureReason,
        resume_after: resumeAfter,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await database
      .insertInto("curation_units")
      .values(units.map((unitStatus, position) => ({ curation_id: id, kind: "project", position, subject_id: randomUUID(), title: `Unit ${position}`, status: unitStatus })))
      .execute();

    return id;
  }

  const saveUnitAt = (curationId: Id, position: number) =>
    database.updateTable("curation_units").set({ status: "saved" }).where("curation_id", "=", curationId).where("position", "=", position).execute();

  it("answers progress null, not a 404, for an Account with no Curation", async () => {
    const { token } = await openSession();

    const response = await poll(token);

    expect(response.status).toBe(200);
    expect(await stateOf(response)).toEqual({ progress: null });
    expect(response.headers.get("etag")).toMatch(/^"[0-9a-f]+"$/);
  });

  it("derives the percentage from the saved units, and a second process answers the same", async () => {
    const { accountId, token } = await openSession();
    const curationId = await curationOf(accountId, await builtProfile(accountId));

    const response = await poll(token);
    const { progress } = await stateOf(response);

    expect(progress).toMatchObject({
      curationId,
      status: "running",
      percentage: 25,
      units: { total: 4, saved: 1 },
      modelId: MODEL_ID,
      failureReason: null,
      resumeAfter: null,
    });
    expect(progress?.units.list.map((unit) => [unit.title, unit.status])).toEqual([
      ["Unit 0", "saved"],
      ["Unit 1", "running"],
      ["Unit 2", "pending"],
      ["Unit 3", "pending"],
    ]);
    expect(progress?.metrics).toEqual({
      careerDuration: { years: 4, months: 0 },
      durationPerCompany: [{ company: "Parapet Systems", duration: { years: 4, months: 0 } }],
      counts: { roles: 2, projects: 1, certifications: 0, languages: 0, education: 0 },
    });

    const fresh = await startedApp();

    try {
      const again = await poll(token, {}, await fresh.getUrl());

      expect(again.headers.get("etag")).toBe(response.headers.get("etag"));
      expect(await stateOf(again)).toEqual({ progress });
    } finally {
      await fresh.close();
    }
  });

  it("answers 304 while nothing changed, and a new ETag once a unit is saved", async () => {
    const { accountId, token } = await openSession();
    const curationId = await curationOf(accountId, await builtProfile(accountId));

    const etag = (await poll(token)).headers.get("etag") ?? "";
    const unchanged = await poll(token, { "if-none-match": etag });

    expect(unchanged.status).toBe(304);
    expect(await unchanged.text()).toBe("");

    await saveUnitAt(curationId, 1);

    const changed = await poll(token, { "if-none-match": etag });

    expect(changed.status).toBe(200);
    expect(changed.headers.get("etag")).not.toBe(etag);
    expect((await stateOf(changed)).progress).toMatchObject({ percentage: 50, units: { saved: 2 } });
  });

  it("answers when a rate-limited Curation resumes, and why a failed one failed", async () => {
    const paused = await openSession();
    const failed = await openSession();
    const resumeAfter = new Date(Date.now() + 60_000);

    await curationOf(paused.accountId, await builtProfile(paused.accountId), { status: "queued", resumeAfter });
    await curationOf(failed.accountId, await builtProfile(failed.accountId), { status: "failed", failureReason: "attempts_exhausted", units: ["saved", "failed"] });

    expect((await stateOf(await poll(paused.token))).progress).toMatchObject({ status: "queued", resumeAfter: resumeAfter.toISOString(), failureReason: null });
    expect((await stateOf(await poll(failed.token))).progress).toMatchObject({ status: "failed", failureReason: "attempts_exhausted", percentage: 50 });
  });

  it("answers the newest Curation of the Profile on screen, and none once it is superseded or its Profile replaced", async () => {
    const retried = await openSession();
    const superseded = await openSession();
    const replaced = await openSession();
    const retriedProfile = await builtProfile(retried.accountId);

    await curationOf(retried.accountId, retriedProfile, { status: "failed", failureReason: "model_key_rejected" });
    const newest = await curationOf(retried.accountId, retriedProfile, { status: "queued", units: ["pending", "pending"] });
    await curationOf(superseded.accountId, await builtProfile(superseded.accountId), { status: "superseded" });
    await curationOf(replaced.accountId, await builtProfile(replaced.accountId, new Date(Date.now() - DAY_MS)), { status: "completed", units: ["saved"] });
    await builtProfile(replaced.accountId);

    expect((await stateOf(await poll(retried.token))).progress).toMatchObject({ curationId: newest, status: "queued", percentage: 0 });
    expect(await stateOf(await poll(superseded.token))).toEqual({ progress: null });
    expect(await stateOf(await poll(replaced.token))).toEqual({ progress: null });
  });

  it("never answers another Account's Curation", async () => {
    const pair = await createAccountPair(database);

    await curationOf(pair.owner, await builtProfile(pair.owner));

    await expectScopedToAccount(pair, async (accountId) => (await service.progressOf(accountId)).progress ?? undefined);
  });

  it("refuses a request without a Session", async () => {
    expect((await request("/profile/curation")).status).toBe(401);
  });
});
