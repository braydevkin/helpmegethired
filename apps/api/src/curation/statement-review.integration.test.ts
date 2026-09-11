import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  CuratedStatementSchema,
  CurationStatementsSchema,
  SESSION_LIFETIME_SECONDS,
  type CurationStatements,
  type CurationStatus,
  type CurationUnitKind,
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
import { StatementReviewService } from "./statement-review.service";
import { StatementRepository } from "./statement.repository";
import { toVectorLiteral } from "./vector";

const MODEL_ID = "claude-sonnet-5";
const PROMPT_VERSION = "curation/1";
const EMBEDDING_DIMENSIONS = 1536;
const DAY_MS = 24 * 60 * 60 * 1000;

// One axis per Statement, and a query leaning on every axis, so each Statement is equally near
// and the retrieval answer depends on the filters alone.
const axis = (index: number): number[] => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, at) => (at === index ? 1 : 0));
const EVERY_AXIS: number[] = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1);

interface SeededUnit {
  kind: CurationUnitKind;
  title: string;
  statements: string[];
}

interface SeededCuration {
  curationId: Id;
  statementIds: Id[];
}

describe("Statement review", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: Database;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let service: StatementReviewService;
  let retrieval: StatementRepository;
  let axisIndex = 0;

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
    service = app.get(StatementReviewService);
    retrieval = app.get(StatementRepository);
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

  const listOf = async (token: string): Promise<CurationStatements> => {
    const response = await request("/profile/curation/statements", token);

    expect(response.status).toBe(200);

    return CurationStatementsSchema.parse(await response.json());
  };

  const review = (token: string, statementId: string, state: unknown) =>
    request(`/profile/curation/statements/${statementId}/review`, token, { method: "PUT", body: { state } });

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

  async function completedIngestion(accountId: Id): Promise<Id> {
    const { id } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  async function statementOf(accountId: Id, ingestionId: Id, curationId: Id, unitId: Id, text: string): Promise<Id> {
    const { id } = await database
      .insertInto("statements")
      .values({
        curation_id: curationId,
        unit_id: unitId,
        account_id: accountId,
        source_ingestion_id: ingestionId,
        text,
        labels: JSON.stringify(["platform"]),
        evidence: JSON.stringify([{ kind: "text_span", referenceId: randomUUID(), quote: text, start: 0, end: text.length }]),
        prompt_version: PROMPT_VERSION,
        model_id: MODEL_ID,
        embedding: toVectorLiteral(axis(axisIndex++)),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  async function curationWith(accountId: Id, status: CurationStatus, units: SeededUnit[], completedAt: Date | null = null): Promise<SeededCuration> {
    const ingestionId = await completedIngestion(accountId);
    const { id: curationId } = await database
      .insertInto("curations")
      .values({
        account_id: accountId,
        source_ingestion_id: ingestionId,
        status,
        attempts: 1,
        max_attempts: 3,
        prompt_version: PROMPT_VERSION,
        model_id: MODEL_ID,
        completed_at: completedAt ?? (status === "completed" ? new Date() : null),
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const statementIds: Id[] = [];

    for (const [position, unit] of units.entries()) {
      const hasSubject = unit.kind === "experience" || unit.kind === "project";
      const { id: unitId } = await database
        .insertInto("curation_units")
        .values({ curation_id: curationId, kind: unit.kind, position, subject_id: hasSubject ? randomUUID() : null, title: unit.title, status: "saved" })
        .returning("id")
        .executeTakeFirstOrThrow();

      for (const text of unit.statements) {
        statementIds.push(await statementOf(accountId, ingestionId, curationId, unitId, text));
      }
    }

    return { curationId, statementIds };
  }

  const oneUnit = (...statements: string[]): SeededUnit[] => [{ kind: "project", title: "Ledger", statements }];

  it("answers no Curation and no Statements until one completes", async () => {
    const { accountId, token } = await openSession();

    await curationWith(accountId, "running", oneUnit("Keeps the ledger balanced."));

    expect(await listOf(token)).toEqual({ curationId: null, statements: [] });
  });

  it("lists the Statements of the current Curation in unit order, each with the unit it came from", async () => {
    const { accountId, token } = await openSession();

    await curationWith(accountId, "completed", oneUnit("Kept an older ledger."), new Date(Date.now() - DAY_MS));
    const current = await curationWith(accountId, "completed", [
      { kind: "experience", title: "Staff Engineer at Parapet Systems", statements: ["Runs the deployment platform for forty teams."] },
      { kind: "synthesis", title: "The Profile as a whole", statements: ["Leads platform work across teams."] },
    ]);
    await curationWith(accountId, "running", oneUnit("Is being re-read right now."));

    const { curationId, statements } = await listOf(token);

    expect(curationId).toBe(current.curationId);
    expect(statements.map(({ id, text, source }) => ({ id, text, source }))).toEqual([
      { id: current.statementIds[0], text: "Runs the deployment platform for forty teams.", source: { unitKind: "experience", title: "Staff Engineer at Parapet Systems" } },
      { id: current.statementIds[1], text: "Leads platform work across teams.", source: { unitKind: "synthesis", title: "The Profile as a whole" } },
    ]);
    expect(statements[0]).toMatchObject({
      labels: ["platform"],
      evidence: [{ kind: "text_span", quote: "Runs the deployment platform for forty teams." }],
      review: { state: "unreviewed", reviewedAt: null },
    });
  });

  it("sets a review, changes it, and clears it back to unreviewed", async () => {
    const { accountId, token } = await openSession();
    const {
      statementIds: [statementId],
    } = await curationWith(accountId, "completed", oneUnit("Keeps the ledger balanced."));

    const accepted = await review(token, statementId!, "accepted");

    expect(accepted.status).toBe(200);
    expect(CuratedStatementSchema.parse(await accepted.json()).review).toMatchObject({ state: "accepted", reviewedAt: expect.any(String) });

    const rejected = CuratedStatementSchema.parse(await (await review(token, statementId!, "rejected")).json());

    expect(rejected).toMatchObject({ id: statementId, review: { state: "rejected" }, source: { unitKind: "project", title: "Ledger" } });

    const cleared = CuratedStatementSchema.parse(await (await review(token, statementId!, "unreviewed")).json());

    expect(cleared.review).toEqual({ state: "unreviewed", reviewedAt: null });
    expect((await listOf(token)).statements[0]?.review).toEqual({ state: "unreviewed", reviewedAt: null });
  });

  it("never retrieves a rejected Statement, keeps its row and its embedding, and retrieves accepted and unreviewed ones", async () => {
    const { accountId, token } = await openSession();
    const {
      statementIds: [acceptedId, rejectedId, unreviewedId],
    } = await curationWith(accountId, "completed", oneUnit("Keeps the ledger balanced.", "Invented a ledger nobody used.", "Closes the books monthly."));

    await review(token, acceptedId!, "accepted");
    await review(token, rejectedId!, "rejected");

    const retrieved = await retrieval.nearest(accountId, EVERY_AXIS, 10);
    const rejectedRow = await database
      .selectFrom("statements")
      .select(["review_state", "embedding"])
      .where("id", "=", rejectedId!)
      .executeTakeFirstOrThrow();

    expect(new Set(retrieved.map((statement) => statement.id))).toEqual(new Set([acceptedId, unreviewedId]));
    expect(rejectedRow.review_state).toBe("rejected");
    expect(rejectedRow.embedding).not.toBeNull();
    expect((await listOf(token)).statements.find((statement) => statement.id === rejectedId)?.review.state).toBe("rejected");
  });

  it("refuses a state it does not know and an id that is not one", async () => {
    const { accountId, token } = await openSession();
    const {
      statementIds: [statementId],
    } = await curationWith(accountId, "completed", oneUnit("Keeps the ledger balanced."));

    expect((await review(token, statementId!, "liked")).status).toBe(400);
    expect((await review(token, "the-first-one", "accepted")).status).toBe(400);
  });

  it("answers another Account's Statement exactly like one that does not exist, and leaves it untouched", async () => {
    const owner = await openSession();
    const other = await openSession();
    const {
      statementIds: [statementId],
    } = await curationWith(owner.accountId, "completed", oneUnit("Keeps the ledger balanced."));

    const foreign = await review(other.token, statementId!, "rejected");
    const missing = await review(other.token, randomUUID(), "rejected");

    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect((await listOf(owner.token)).statements[0]?.review.state).toBe("unreviewed");
    expect(await listOf(other.token)).toEqual({ curationId: null, statements: [] });
  });

  it("never reviews or lists another Account's Statements", async () => {
    const pair = await createAccountPair(database);
    const {
      statementIds: [statementId],
    } = await curationWith(pair.owner, "completed", oneUnit("Keeps the ledger balanced."));

    await expectScopedToAccount(pair, (accountId) => service.review(accountId, statementId!, "accepted"));
    await expectScopedToAccount(pair, async (accountId) => {
      const { statements } = await service.statementsOf(accountId);

      return statements.length > 0 ? statements : undefined;
    });
  });

  it("refuses a request without a Session", async () => {
    expect((await request("/profile/curation/statements")).status).toBe(401);
    expect((await review("", randomUUID(), "accepted")).status).toBe(401);
  });
});
