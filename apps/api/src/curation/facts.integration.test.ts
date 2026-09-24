import type { CurationStatus, Id } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase, type Database } from "../database/database";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { CurationRunRepository } from "./curation-run.repository";
import { CurationRepository } from "./curation.repository";
import { FactRepository } from "./fact.repository";
import type { NewFact } from "./facts-of";

const CHECK_VIOLATION = { code: "23514" };

const years: NewFact = { kind: "years_of_experience", text: "Years of experience: 2 years", sourceId: null };

describe("the Facts of a Curation", () => {
  let database: Database;
  let runs: CurationRunRepository;
  let curations: CurationRepository;
  let facts: FactRepository;

  beforeAll(() => {
    database = createDatabase(validateDatabaseEnvironment(process.env).DATABASE_URL);
    runs = new CurationRunRepository(database);
    curations = new CurationRepository(database);
    facts = new FactRepository(database);
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

  async function insertCuration(accountId: Id, status: CurationStatus, ingestionId?: Id): Promise<{ id: Id; ingestionId: Id }> {
    const sourceIngestionId = ingestionId ?? (await completedIngestion(accountId));
    const { id } = await database
      .insertInto("curations")
      .values({ account_id: accountId, source_ingestion_id: sourceIngestionId, status, max_attempts: 3, prompt_version: "curation/1", model_id: "claude-sonnet-5" })
      .returning("id")
      .executeTakeFirstOrThrow();

    return { id, ingestionId: sourceIngestionId };
  }

  async function insertEducation(accountId: Id, ingestionId: Id): Promise<Id> {
    const { id } = await database
      .insertInto("education")
      .values({ account_id: accountId, source_ingestion_id: ingestionId, segment_position: 0, position: 0, institution: "University of Cambridge", degree: "MSc", field_of_study: "Computer Science" })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  const factRowsOf = (curationId: Id) => database.selectFrom("facts").selectAll().where("curation_id", "=", curationId).orderBy("position").execute();

  describe("the facts table", () => {
    it.each([
      ["a Fact of an unknown kind", { kind: "experience", source_id: null }],
      ["an Education Fact that names no source", { kind: "education", source_id: null }],
      ["years of experience that name a source", { kind: "years_of_experience", source_id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b" }],
    ])("refuses %s", async (_label, values) => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner, "completed");

      await expect(
        database
          .insertInto("facts")
          .values({ curation_id: id, account_id: owner, text: "A fact", position: 0, ...(values as { kind: "education"; source_id: null }) })
          .execute(),
      ).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("goes with its Curation", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner, "completed");
      await database.insertInto("facts").values({ curation_id: id, account_id: owner, position: 0, kind: years.kind, text: years.text, source_id: null }).execute();

      await database.deleteFrom("curations").where("id", "=", id).execute();

      expect(await factRowsOf(id)).toEqual([]);
    });
  });

  describe("completing a Curation", () => {
    it("records the Facts in the write that marks it completed, in their order", async () => {
      const { owner } = await createAccountPair(database);
      const { id, ingestionId } = await insertCuration(owner, "running");
      const educationId = await insertEducation(owner, ingestionId);
      const education: NewFact = { kind: "education", text: "Education: MSc in Computer Science, University of Cambridge", sourceId: educationId };

      expect(await runs.completeWithEmbeddings(id, [], [years, education])).toBe(true);

      expect(await factRowsOf(id)).toMatchObject([
        { account_id: owner, kind: "years_of_experience", text: years.text, source_id: null, position: 0 },
        { account_id: owner, kind: "education", text: education.text, source_id: educationId, position: 1 },
      ]);
      expect((await database.selectFrom("curations").select("status").where("id", "=", id).executeTakeFirstOrThrow()).status).toBe("completed");
    });

    it("records nothing for a Curation that is no longer running", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner, "cancelled");

      expect(await runs.completeWithEmbeddings(id, [], [years])).toBe(false);
      expect(await factRowsOf(id)).toEqual([]);
    });

    it("deletes the Facts of the Curation it supersedes", async () => {
      const { owner } = await createAccountPair(database);
      const earlier = await insertCuration(owner, "running");
      await runs.completeWithEmbeddings(earlier.id, [], [years]);
      const later = await insertCuration(owner, "running", earlier.ingestionId);

      expect(await runs.completeWithEmbeddings(later.id, [], [years])).toBe(true);

      expect((await database.selectFrom("curations").select("status").where("id", "=", earlier.id).executeTakeFirstOrThrow()).status).toBe("superseded");
      expect(await factRowsOf(earlier.id)).toEqual([]);
      expect(await factRowsOf(later.id)).toHaveLength(1);
    });
  });

  describe("a new Ingestion", () => {
    it("deletes the Facts with the Statements of the Curations it supersedes", async () => {
      const { owner } = await createAccountPair(database);
      const earlier = await insertCuration(owner, "running");
      await runs.completeWithEmbeddings(earlier.id, [], [years]);
      const keptIngestionId = await completedIngestion(owner);

      const superseded = await database.transaction().execute((transaction) => curations.supersedeEarlierThan(owner, keptIngestionId, transaction));

      expect(superseded).toEqual([earlier.id]);
      expect(await factRowsOf(earlier.id)).toEqual([]);
    });
  });

  describe("a Curation completed before Facts existed", () => {
    it("is found while it has none, gets them once, and is left alone after", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner, "completed");

      expect((await runs.findCompletedWithoutFacts()).map((run) => run.id)).toContain(id);
      expect(await runs.backfillFacts(id, [years])).toBe(true);
      expect(await runs.backfillFacts(id, [years])).toBe(false);

      expect((await runs.findCompletedWithoutFacts()).map((run) => run.id)).not.toContain(id);
      expect(await factRowsOf(id)).toHaveLength(1);
    });

    it("is not backfilled once it is no longer completed", async () => {
      const { owner } = await createAccountPair(database);
      const { id } = await insertCuration(owner, "superseded");

      expect((await runs.findCompletedWithoutFacts()).map((run) => run.id)).not.toContain(id);
      expect(await runs.backfillFacts(id, [years])).toBe(false);
      expect(await factRowsOf(id)).toEqual([]);
    });
  });

  describe("reading the Facts", () => {
    it("answers them in order as the shared Fact, and only to their Account", async () => {
      const pair = await createAccountPair(database);
      const { id, ingestionId } = await insertCuration(pair.owner, "running");
      const educationId = await insertEducation(pair.owner, ingestionId);
      await runs.completeWithEmbeddings(id, [], [years, { kind: "education", text: "Education: MSc, University of Cambridge", sourceId: educationId }]);

      expect(await facts.ofCuration(pair.owner, id)).toMatchObject([
        { kind: "years_of_experience", text: years.text, sourceId: null },
        { kind: "education", text: "Education: MSc, University of Cambridge", sourceId: educationId },
      ]);
      await expectScopedToAccount(pair, async (accountId) => {
        const read = await facts.ofCuration(accountId, id);

        return read.length > 0 ? read : undefined;
      });
    });
  });
});
