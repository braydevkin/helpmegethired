import type { CurationStatus, Id } from "@helpmegethired/shared";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase, type Database } from "../database/database";
import { createAccountPair } from "../database/testing/account-pair";

const UNIQUE_VIOLATION = { code: "23505" };
const CHECK_VIOLATION = { code: "23514" };

const vectorOf = (dimensions: number): string => `[${Array.from({ length: dimensions }, () => "0.1").join(",")}]`;

describe("the curation tables", () => {
  let database: Database;

  beforeAll(() => {
    database = createDatabase(validateDatabaseEnvironment(process.env).DATABASE_URL);
  });

  afterAll(async () => {
    await database.destroy();
  });

  async function completedIngestion(accountId: Id): Promise<Id> {
    const { id } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3 })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  async function insertCuration(accountId: Id, status: CurationStatus = "queued"): Promise<{ id: Id; ingestionId: Id }> {
    const ingestionId = await completedIngestion(accountId);
    const { id } = await database
      .insertInto("curations")
      .values({ account_id: accountId, source_ingestion_id: ingestionId, status, max_attempts: 3, prompt_version: "curation/1", model_id: "claude-sonnet-5" })
      .returning("id")
      .executeTakeFirstOrThrow();

    return { id, ingestionId };
  }

  async function insertSynthesisUnit(curationId: Id, position = 0): Promise<Id> {
    const { id } = await database
      .insertInto("curation_units")
      .values({ curation_id: curationId, kind: "synthesis", position, title: "The whole career, read together" })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  async function insertStatement(accountId: Id, values: { embedding?: string; review_state?: "rejected"; reviewed_at?: Date | null } = {}): Promise<Id> {
    const curation = await insertCuration(accountId, "completed");
    const unitId = await insertSynthesisUnit(curation.id);
    const { id } = await database
      .insertInto("statements")
      .values({
        curation_id: curation.id,
        unit_id: unitId,
        account_id: accountId,
        source_ingestion_id: curation.ingestionId,
        text: "Leads the ingestion platform at Analytical Engines Ltd since March 2021.",
        evidence: JSON.stringify([{ kind: "text_span", referenceId: curation.ingestionId, quote: "Leads", start: 0, end: 5 }]),
        prompt_version: "synthesis/1",
        model_id: "claude-sonnet-5",
        ...values,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  describe("one active Curation per Account", () => {
    it.each<[CurationStatus, CurationStatus]>([
      ["queued", "queued"],
      ["queued", "running"],
      ["running", "queued"],
    ])("refuses a %s Curation beside a %s one", async (first, second) => {
      const { owner } = await createAccountPair(database);
      await insertCuration(owner, first);

      await expect(insertCuration(owner, second)).rejects.toMatchObject(UNIQUE_VIOLATION);
    });

    it.each<CurationStatus>(["completed", "failed", "cancelled", "superseded"])("keeps a %s Curation beside the active one", async (terminal) => {
      const { owner } = await createAccountPair(database);
      await insertCuration(owner, terminal);
      await insertCuration(owner, terminal);

      await expect(insertCuration(owner, "queued")).resolves.toBeDefined();
    });

    it("lets each Account hold its own active Curation", async () => {
      const { owner, other } = await createAccountPair(database);
      await insertCuration(owner, "running");

      await expect(insertCuration(other, "running")).resolves.toBeDefined();
    });
  });

  it("refuses a Curation failure reason outside the closed list", async () => {
    const { owner } = await createAccountPair(database);
    const { id } = await insertCuration(owner, "completed");

    await expect(
      database.updateTable("curations").set({ status: "failed", failure_reason: "overloaded_error" as never }).where("id", "=", id).execute(),
    ).rejects.toMatchObject(CHECK_VIOLATION);
  });

  describe("curation units", () => {
    it("refuses an Experience unit that names no subject", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner);

      await expect(
        database.insertInto("curation_units").values({ curation_id: id, kind: "experience", position: 0, title: "An Experience" }).execute(),
      ).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("refuses a synthesis unit that names a subject", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner);

      await expect(
        database
          .insertInto("curation_units")
          .values({ curation_id: id, kind: "synthesis", position: 0, title: "The whole career", subject_id: owner })
          .execute(),
      ).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("refuses two units at one position of a Curation", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner);
      await insertSynthesisUnit(id, 0);

      await expect(insertSynthesisUnit(id, 0)).rejects.toMatchObject(UNIQUE_VIOLATION);
    });
  });

  describe("statements", () => {
    it("declare the embedding as vector(1536)", async () => {
      const { rows } = await sql<{ type: string }>`
        select format_type(atttypid, atttypmod) as type from pg_attribute
        where attrelid = 'statements'::regclass and attname = 'embedding'`.execute(database);

      expect(rows).toEqual([{ type: "vector(1536)" }]);
    });

    it("store a 1536-dimension embedding and refuse any other", async () => {
      const { owner } = await createAccountPair(database);

      await expect(insertStatement(owner, { embedding: vectorOf(1536) })).resolves.toBeDefined();
      await expect(insertStatement(owner, { embedding: vectorOf(3) })).rejects.toThrow(/1536/);
    });

    it("index the embedding with HNSW and leave rejected Statements out of both retrieval indexes", async () => {
      const { rows } = await sql<{ indexname: string; indexdef: string }>`
        select indexname, indexdef from pg_indexes
        where tablename = 'statements' and indexname like 'statements_retrievable_%'
        order by indexname`.execute(database);

      expect(rows.map((row) => row.indexname)).toEqual(["statements_retrievable_embedding_idx", "statements_retrievable_per_account_idx"]);
      expect(rows[0]?.indexdef).toMatch(/USING hnsw \(embedding vector_cosine_ops\)/);
      for (const row of rows) {
        expect(row.indexdef).toMatch(/WHERE \(review_state <> 'rejected'::text\)/);
      }
    });

    it("refuse a rejection with no review time", async () => {
      const { owner } = await createAccountPair(database);

      await expect(insertStatement(owner, { review_state: "rejected", reviewed_at: null })).rejects.toMatchObject(CHECK_VIOLATION);
      await expect(insertStatement(owner, { review_state: "rejected", reviewed_at: new Date() })).resolves.toBeDefined();
    });
  });

  it("removes an Account's Curations, units and Statements with it, and nobody else's", async () => {
    const { owner, other } = await createAccountPair(database);
    await insertStatement(owner);
    await insertStatement(other);

    await database.deleteFrom("accounts").where("id", "=", owner).execute();

    const remaining = async (accountId: Id) => ({
      curations: (await database.selectFrom("curations").select("id").where("account_id", "=", accountId).execute()).length,
      units: (
        await database
          .selectFrom("curation_units")
          .innerJoin("curations", "curations.id", "curation_units.curation_id")
          .select("curation_units.id")
          .where("curations.account_id", "=", accountId)
          .execute()
      ).length,
      statements: (await database.selectFrom("statements").select("id").where("account_id", "=", accountId).execute()).length,
    });

    expect(await remaining(owner)).toEqual({ curations: 0, units: 0, statements: 0 });
    expect(await remaining(other)).toEqual({ curations: 1, units: 1, statements: 1 });
  });
});
