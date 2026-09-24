import { JOB_DESCRIPTION_MAX_CHARACTERS, type Id, type JobAnalysisStatus, type LayerKind, type LayerStatus } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateDatabaseEnvironment } from "../config/validate-environment";
import { createDatabase, type Database } from "../database/database";
import { createAccountPair } from "../database/testing/account-pair";

const UNIQUE_VIOLATION = { code: "23505" };
const CHECK_VIOLATION = { code: "23514" };

const text = "Senior Software Engineer. You have run a data ingestion platform in production.";

describe("the Job Analysis tables", () => {
  let database: Database;

  beforeAll(() => {
    database = createDatabase(validateDatabaseEnvironment(process.env).DATABASE_URL);
  });

  afterAll(async () => {
    await database.destroy();
  });

  async function completedCuration(accountId: Id): Promise<Id> {
    const { id: ingestionId } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3 })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id } = await database
      .insertInto("curations")
      .values({ account_id: accountId, source_ingestion_id: ingestionId, status: "completed", max_attempts: 3, prompt_version: "curation/1", model_id: "claude-sonnet-5" })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  async function insertJobDescription(accountId: Id, pasted = text): Promise<Id> {
    const { id } = await database.insertInto("job_descriptions").values({ account_id: accountId, text: pasted }).returning("id").executeTakeFirstOrThrow();

    return id;
  }

  async function insertJobAnalysis(accountId: Id, status: JobAnalysisStatus = "queued", overrides: Record<string, unknown> = {}): Promise<Id> {
    const { id } = await database
      .insertInto("job_analyses")
      .values({
        account_id: accountId,
        job_description_id: await insertJobDescription(accountId, `${text} ${status} ${Math.random()}`),
        curation_id: await completedCuration(accountId),
        status,
        max_attempts: 3,
        model_id: "claude-sonnet-5",
        requirement_match_prompt_version: "requirement-match/1",
        resume_builder_prompt_version: "resume-builder/1",
        ats_rule_set_version: "ats-rules/1",
        ...overrides,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return id;
  }

  const insertLayer = (jobAnalysisId: Id, kind: LayerKind, position: number, status: LayerStatus = "pending", output: string | null = null) =>
    database.insertInto("job_analysis_layers").values({ job_analysis_id: jobAnalysisId, kind, position, status, output }).execute();

  describe("one active Job Analysis per Account", () => {
    it.each<[JobAnalysisStatus, JobAnalysisStatus]>([
      ["queued", "queued"],
      ["queued", "running"],
      ["running", "queued"],
    ])("refuses a %s Job Analysis beside a %s one", async (first, second) => {
      const { owner } = await createAccountPair(database);
      await insertJobAnalysis(owner, first);

      await expect(insertJobAnalysis(owner, second)).rejects.toMatchObject(UNIQUE_VIOLATION);
    });

    it.each<JobAnalysisStatus>(["completed", "failed", "cancelled", "superseded"])("keeps a %s Job Analysis beside the active one", async (terminal) => {
      const { owner } = await createAccountPair(database);
      await insertJobAnalysis(owner, terminal);

      await expect(insertJobAnalysis(owner, "running")).resolves.toBeDefined();
    });

    it("lets two Accounts each run one", async () => {
      const { owner, other } = await createAccountPair(database);
      await insertJobAnalysis(owner, "running");

      await expect(insertJobAnalysis(other, "running")).resolves.toBeDefined();
    });
  });

  describe("a Job Description", () => {
    it("is one row for the same text pasted twice by one Account, and two rows for two Accounts", async () => {
      const { owner, other } = await createAccountPair(database);
      await insertJobDescription(owner);

      await expect(insertJobDescription(owner)).rejects.toMatchObject(UNIQUE_VIOLATION);
      await expect(insertJobDescription(other)).resolves.toBeDefined();
    });

    it("is a new row for different text by the same Account", async () => {
      const { owner } = await createAccountPair(database);
      await insertJobDescription(owner);

      await expect(insertJobDescription(owner, `${text} Remote.`)).resolves.toBeDefined();
    });

    it.each([
      ["an empty text", ""],
      ["a text over the cap", "a".repeat(JOB_DESCRIPTION_MAX_CHARACTERS + 1)],
    ])("refuses %s", async (_label, pasted) => {
      const { owner } = await createAccountPair(database);

      await expect(insertJobDescription(owner, pasted)).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("accepts a text at the cap", async () => {
      const { owner } = await createAccountPair(database);

      await expect(insertJobDescription(owner, "a".repeat(JOB_DESCRIPTION_MAX_CHARACTERS))).resolves.toBeDefined();
    });
  });

  describe("a Job Analysis", () => {
    it.each([
      ["an unknown status", { status: "done" }],
      ["a failure reason the page cannot show", { status: "failed", failure_reason: "Anthropic: 401" }],
      ["a failed Layer without a failure reason", { failed_layer: "requirement_match" }],
      ["an unknown failed Layer", { status: "failed", failure_reason: "attempts_exhausted", failed_layer: "title_match" }],
      ["a pause reason the page cannot show", { pause_reason: "quota" }],
      ["no attempt allowed", { max_attempts: 0 }],
    ])("refuses %s", async (_label, overrides) => {
      const { owner } = await createAccountPair(database);

      await expect(insertJobAnalysis(owner, "queued", overrides)).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("accepts a failed Job Analysis naming the Layer that stopped, and a paused one with its reason", async () => {
      const { owner } = await createAccountPair(database);

      await expect(insertJobAnalysis(owner, "failed", { failure_reason: "attempts_exhausted", failed_layer: "requirement_match" })).resolves.toBeDefined();
      await expect(insertJobAnalysis(owner, "queued", { pause_reason: "provider_rate_limit", resume_after: new Date() })).resolves.toBeDefined();
    });
  });

  describe("a Layer", () => {
    it("holds the three Layers of a Job Analysis in order, each once", async () => {
      const { owner } = await createAccountPair(database);
      const jobAnalysisId = await insertJobAnalysis(owner);

      await insertLayer(jobAnalysisId, "requirement_match", 0);
      await insertLayer(jobAnalysisId, "ats_score", 1);
      await insertLayer(jobAnalysisId, "resume_builder", 2);

      await expect(insertLayer(jobAnalysisId, "ats_score", 3)).rejects.toMatchObject(UNIQUE_VIOLATION);
      await expect(insertLayer(jobAnalysisId, "requirement_match", 1)).rejects.toMatchObject(UNIQUE_VIOLATION);
    });

    it("carries an output exactly when it completed", async () => {
      const { owner } = await createAccountPair(database);
      const jobAnalysisId = await insertJobAnalysis(owner);

      await expect(insertLayer(jobAnalysisId, "requirement_match", 0, "completed", JSON.stringify({ requirements: [] }))).resolves.toBeDefined();
      await expect(insertLayer(jobAnalysisId, "ats_score", 1, "completed", null)).rejects.toMatchObject(CHECK_VIOLATION);
      await expect(insertLayer(jobAnalysisId, "ats_score", 1, "pending", JSON.stringify({ score: 7 }))).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("can be skipped only when it is the Resume Builder", async () => {
      const { owner } = await createAccountPair(database);
      const jobAnalysisId = await insertJobAnalysis(owner);

      await expect(insertLayer(jobAnalysisId, "resume_builder", 2, "skipped")).resolves.toBeDefined();
      await expect(insertLayer(jobAnalysisId, "ats_score", 1, "skipped")).rejects.toMatchObject(CHECK_VIOLATION);
    });

    it("refuses a Layer of an unknown kind or with a Provider's own message as reason", async () => {
      const { owner } = await createAccountPair(database);
      const jobAnalysisId = await insertJobAnalysis(owner);

      await expect(insertLayer(jobAnalysisId, "title_match" as LayerKind, 0)).rejects.toMatchObject(CHECK_VIOLATION);
      await expect(
        database.insertInto("job_analysis_layers").values({ job_analysis_id: jobAnalysisId, kind: "ats_score", position: 1, status: "failed", failure_reason: "429" as never }).execute(),
      ).rejects.toMatchObject(CHECK_VIOLATION);
    });
  });

  describe("deleting an Account", () => {
    it("removes its Job Descriptions, Job Analyses, and Layers", async () => {
      const { owner } = await createAccountPair(database);
      const jobAnalysisId = await insertJobAnalysis(owner, "completed");
      await insertLayer(jobAnalysisId, "requirement_match", 0, "completed", JSON.stringify({ requirements: [] }));

      await database.deleteFrom("accounts").where("id", "=", owner).execute();

      expect(await database.selectFrom("job_descriptions").select("id").where("account_id", "=", owner).execute()).toEqual([]);
      expect(await database.selectFrom("job_analyses").select("id").where("account_id", "=", owner).execute()).toEqual([]);
      expect(await database.selectFrom("job_analysis_layers").select("id").where("job_analysis_id", "=", jobAnalysisId).execute()).toEqual([]);
    });
  });
});
