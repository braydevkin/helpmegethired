import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JOB_DESCRIPTION_MAX_CHARACTERS, JobDescriptionOverviewListSchema, JobDescriptionOverviewSchema, SESSION_LIFETIME_SECONDS, type Id } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { SessionRepository } from "../auth/session.repository";
import { hashSessionToken } from "../auth/session-token";
import { DATABASE, type Database } from "../database/database";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { QUEUE_PREFIX } from "../queue/queues";
import { JobDescriptionRepository } from "./job-description.repository";

const text = "Senior Software Engineer. You have run a data ingestion platform in production.";

describe("Job Descriptions", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: Database;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let repository: JobDescriptionRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    database = app.get(DATABASE);
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
    repository = app.get(JobDescriptionRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  const request = (path: string, token?: string, init: { method?: string; body?: unknown } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

  const paste = (token: string | undefined, pasted: unknown) => request("/job-descriptions", token, { method: "POST", body: { text: pasted } });

  const openSession = async (accountId?: Id): Promise<{ accountId: Id; token: string }> => {
    const id = accountId ?? (await accounts.create({ email: `${randomUUID()}@candidate.example` })).id;
    const token = randomUUID();

    await sessions.create({ accountId: id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000) });

    return { accountId: id, token };
  };

  async function completedCuration(accountId: Id): Promise<Id> {
    const { id: ingestionId } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id } = await database
      .insertInto("curations")
      .values({ account_id: accountId, source_ingestion_id: ingestionId, status: "completed", max_attempts: 3, prompt_version: "curation/1", model_id: "claude-sonnet-5", completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  const curatedSession = async () => {
    const session = await openSession();
    const curationId = await completedCuration(session.accountId);

    return { ...session, curationId };
  };

  const rowsOf = (accountId: Id) => database.selectFrom("job_descriptions").select(["id", "text"]).where("account_id", "=", accountId).execute();

  async function analysedJobDescription(accountId: Id, curationId: Id, jobDescriptionId: Id, status: "completed" | "queued", score: number | null) {
    const { id } = await database
      .insertInto("job_analyses")
      .values({
        account_id: accountId,
        job_description_id: jobDescriptionId,
        curation_id: curationId,
        status,
        max_attempts: 3,
        model_id: "claude-sonnet-5",
        requirement_match_prompt_version: "requirement-match/1",
        resume_builder_prompt_version: "resume-builder/1",
        ats_rule_set_version: "ats-rules/1",
        completed_at: status === "completed" ? new Date() : null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    if (score !== null) {
      await database
        .insertInto("job_analysis_layers")
        .values({ job_analysis_id: id, kind: "ats_score", position: 1, status: "completed", output: JSON.stringify({ score, ruleSetVersion: "ats-rules/1", breakdown: [] }) })
        .execute();
    }

    return id;
  }

  describe("pasting", () => {
    it("keeps the text once and answers the same Job Description for the same text", async () => {
      const { accountId, token } = await curatedSession();

      const first = await paste(token, `  ${text}\n`);
      const again = await paste(token, text);

      expect(first.status).toBe(201);
      expect(again.status).toBe(200);

      const kept = JobDescriptionOverviewSchema.parse(await first.json());

      expect(kept).toMatchObject({ text, newestAnalysis: null });
      expect(JobDescriptionOverviewSchema.parse(await again.json()).id).toBe(kept.id);
      expect(await rowsOf(accountId)).toEqual([{ id: kept.id, text }]);
    });

    it("keeps different text as a new Job Description", async () => {
      const { accountId, token } = await curatedSession();
      await paste(token, text);

      const other = await paste(token, `${text} Remote.`);

      expect(other.status).toBe(201);
      expect(await rowsOf(accountId)).toHaveLength(2);
    });

    it("refuses text over the cap with a code the page can act on", async () => {
      const { token } = await curatedSession();

      const response = await paste(token, "a".repeat(JOB_DESCRIPTION_MAX_CHARACTERS + 1));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "job_description_too_long", issues: [{ path: "text" }] });
    });

    it.each([
      ["an empty text", ""],
      ["no text", undefined],
      ["a number", 42],
    ])("refuses %s", async (_label, pasted) => {
      const { token } = await curatedSession();

      const response = await paste(token, pasted);

      expect(response.status).toBe(400);
      expect(await response.json()).not.toHaveProperty("code");
    });

    it("refuses a paste while the Account has no completed Curation, and keeps nothing", async () => {
      const { accountId, token } = await openSession();

      const response = await paste(token, text);

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "curation_not_completed" });
      expect(await rowsOf(accountId)).toEqual([]);
    });

    it("refuses a paste without a Session", async () => {
      expect((await paste(undefined, text)).status).toBe(401);
    });
  });

  describe("reading", () => {
    it("lists the Account's Job Descriptions newest first, each with its newest Job Analysis", async () => {
      const { accountId, token, curationId } = await curatedSession();
      const older = JobDescriptionOverviewSchema.parse(await (await paste(token, text)).json());
      const newer = JobDescriptionOverviewSchema.parse(await (await paste(token, `${text} Remote.`)).json());
      await analysedJobDescription(accountId, curationId, older.id, "completed", 7);
      const newest = await analysedJobDescription(accountId, curationId, older.id, "queued", null);

      const response = await request("/job-descriptions", token);

      expect(response.status).toBe(200);
      expect(JobDescriptionOverviewListSchema.parse(await response.json())).toMatchObject([
        { id: newer.id, newestAnalysis: null },
        { id: older.id, newestAnalysis: { id: newest, status: "queued", atsScore: null, completedAt: null } },
      ]);
    });

    it("answers one Job Description with the score its newest Job Analysis counted", async () => {
      const { accountId, token, curationId } = await curatedSession();
      const kept = JobDescriptionOverviewSchema.parse(await (await paste(token, text)).json());
      const analysisId = await analysedJobDescription(accountId, curationId, kept.id, "completed", 7);

      const response = await request(`/job-descriptions/${kept.id}`, token);

      expect(response.status).toBe(200);
      expect(JobDescriptionOverviewSchema.parse(await response.json())).toMatchObject({ id: kept.id, text, newestAnalysis: { id: analysisId, status: "completed", atsScore: 7 } });
    });

    it("answers another Account's Job Description exactly like one that does not exist", async () => {
      const owner = await curatedSession();
      const other = await openSession();
      const kept = JobDescriptionOverviewSchema.parse(await (await paste(owner.token, text)).json());

      const foreign = await request(`/job-descriptions/${kept.id}`, other.token);
      const unknown = await request(`/job-descriptions/${randomUUID()}`, other.token);

      expect(foreign.status).toBe(404);
      expect(unknown.status).toBe(404);

      const foreignBody: unknown = await foreign.json();

      expect(foreignBody).toEqual(await unknown.json());
      expect(foreignBody).toMatchObject({ code: "job_description_not_found" });
      expect(JobDescriptionOverviewListSchema.parse(await (await request("/job-descriptions", other.token)).json())).toEqual([]);
    });

    it("refuses an id that is not one", async () => {
      const { token } = await curatedSession();

      expect((await request("/job-descriptions/the-first-one", token)).status).toBe(400);
    });

    it("scopes every read to the Account", async () => {
      const pair = await createAccountPair(database);
      const { id } = await repository.keep(pair.owner, text);

      await expectScopedToAccount(pair, (accountId) => repository.findOverview(accountId, id));
      await expectScopedToAccount(pair, async (accountId) => {
        const listed = await repository.overviewsOf(accountId);

        return listed.length > 0 ? listed : undefined;
      });
    });
  });
});
