import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Logger, type INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id } from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AccountRepository } from "../auth/account.repository";
import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { ExtractionHandover } from "../extraction/extraction-handover";
import { UploadedResumeRunRepository } from "../extraction/uploaded-resume-run.repository";
import { IngestionQueue } from "../ingestion/ingestion-queue";
import { IngestionRunner } from "../ingestion/ingestion.runner";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileIngestionModule } from "../profile/profile-ingestion.module";
import { ProfileRepository } from "../profile/profile.repository";
import { ProfileService } from "../profile/profile.service";
import { QUEUE_PREFIX } from "../queue/queues";
import { resumeObjectKeyFor } from "../resumes/resume-object-key";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { EXTRACTION_MAX_ATTEMPTS } from "../resumes/uploaded-resume.service";
import { CurationQueue } from "./curation-queue";
import { CURATION_RUNNER_SETTINGS } from "./curation-runner-settings";
import { CurationRunnerModule } from "./curation-runner.module";
import { CurationRunner } from "./curation.runner";
import { CurationModel, type CurationAnswer, type CurationCall } from "./model/curation-model";
import { FakeCurationModel, type FakeCurationOutcome } from "./model/fake-curation-model";
import { StatementRepository } from "./statement.repository";

const corpus = join(__dirname, "../../test/fixtures/resumes/corpus");
const fixture = (slug: string) => readFileSync(join(corpus, `${slug}.txt`), "utf8");

const anyQuery = Array.from({ length: 1536 }, () => 1);

// The deterministic fake from #111, with a hook before each call so a test can complete a new
// Ingestion while a unit is in flight.
class InterruptibleModel extends CurationModel {
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

class IdleIngestionQueue extends IngestionQueue {
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

class IdleCurationQueue extends CurationQueue {
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

describe("a new Ingestion supersedes the current Curation", () => {
  let context: INestApplicationContext;
  let database: Database;
  let accounts: AccountRepository;
  let uploads: UploadedResumeRepository;
  let resumeRuns: UploadedResumeRunRepository;
  let handover: ExtractionHandover;
  let ingestionRunner: IngestionRunner;
  let profileRows: ProfileRepository;
  let profiles: ProfileService;
  let choices: ModelChoiceService;
  let runner: CurationRunner;
  let statements: StatementRepository;
  const model = new InterruptibleModel();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileIngestionModule, CurationRunnerModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(IngestionQueue)
      .useValue(new IdleIngestionQueue())
      .overrideProvider(CurationQueue)
      .useValue(new IdleCurationQueue())
      .overrideProvider(CurationModel)
      .useValue(model)
      .overrideProvider(CURATION_RUNNER_SETTINGS)
      .useValue({ unitConcurrency: 1 })
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    accounts = context.get(AccountRepository);
    uploads = context.get(UploadedResumeRepository);
    resumeRuns = context.get(UploadedResumeRunRepository);
    handover = context.get(ExtractionHandover);
    ingestionRunner = context.get(IngestionRunner);
    profileRows = context.get(ProfileRepository);
    profiles = context.get(ProfileService);
    choices = context.get(ModelChoiceService);
    runner = context.get(CurationRunner);
    statements = context.get(StatementRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    model.reset();
    vi.restoreAllMocks();
  });

  // A fixture resume through extraction, hand-over and every Segment, as the worker runs it.
  const built = async (accountId: Id, slug: string): Promise<Id> => {
    const id = randomUUID();

    await uploads.create(accountId, {
      id,
      fileName: `${slug}.pdf`,
      sizeBytes: 1024,
      sha256: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      objectKey: resumeObjectKeyFor(accountId, id),
      maxAttempts: EXTRACTION_MAX_ATTEMPTS,
    });
    await uploads.markUploaded(accountId, id);
    await resumeRuns.beginAttempt(id);
    await handover.handOver(await resumeRuns.saveText(id, { text: fixture(slug), extractorVersion: "pdftotext/test" }));

    const ingestionId = (await resumeRuns.findById(id))?.ingestionId;

    if (!ingestionId) {
      throw new Error("The hand-over did not link an Ingestion");
    }

    await ingestionRunner.run(ingestionId);

    return ingestionId;
  };

  // A confirmed Profile with a stored Model Key, which is what leaves a queued Curation (#112).
  const curated = async (): Promise<{ accountId: Id; curationId: Id }> => {
    const { id: accountId } = await accounts.create({ email: `${randomUUID()}@candidate.example` });

    await built(accountId, "ada-single-column-en");
    await choices.save(accountId, { provider: "anthropic", modelId: "claude-sonnet-5", key: `sk-ant-api03-candidate-${randomUUID()}` });
    await profiles.confirm(accountId);

    const { id: curationId } = await database.selectFrom("curations").select("id").where("account_id", "=", accountId).executeTakeFirstOrThrow();

    return { accountId, curationId };
  };

  const curationOf = (id: Id) => database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  const unitsOf = (id: Id) => database.selectFrom("curation_units").selectAll().where("curation_id", "=", id).execute();
  const statementsOf = (accountId: Id) => database.selectFrom("statements").selectAll().where("account_id", "=", accountId).execute();

  it("supersedes a completed Curation and deletes its Statements and embeddings, so retrieval finds nothing", async () => {
    const { accountId, curationId } = await curated();
    await runner.run(curationId);
    expect((await curationOf(curationId)).status).toBe("completed");
    expect(await statements.nearest(accountId, anyQuery, 10)).not.toEqual([]);

    await built(accountId, "kenji-single-column-en");

    expect(await curationOf(curationId)).toMatchObject({ status: "superseded", failure_reason: null });
    expect(await statementsOf(accountId)).toEqual([]);
    expect(await statements.nearest(accountId, anyQuery, 10)).toEqual([]);
  });

  it("keeps the Curation and its Statements when the transaction replacing the Profile rolls back", async () => {
    const { accountId, curationId } = await curated();
    await runner.run(curationId);
    const before = await statementsOf(accountId);
    vi.spyOn(profileRows, "deleteRowsOfEarlierIngestions").mockRejectedValue(new Error("database unreachable"));

    await expect(built(accountId, "kenji-single-column-en")).rejects.toThrow("database unreachable");

    expect((await curationOf(curationId)).status).toBe("completed");
    expect(await statementsOf(accountId)).toHaveLength(before.length);
  });

  it("stops a running Curation at its next unit boundary, writing nothing for the unit in flight", async () => {
    const { accountId, curationId } = await curated();
    model.beforeCall = async (callNumber) => {
      if (callNumber === 1) {
        await built(accountId, "kenji-single-column-en");
      }
    };

    await expect(runner.run(curationId)).resolves.toBeUndefined();

    expect(model.calls).toHaveLength(1);
    expect((await curationOf(curationId)).status).toBe("superseded");
    expect((await unitsOf(curationId)).some((unit) => unit.status === "saved")).toBe(false);
    expect(await statementsOf(accountId)).toEqual([]);
  });

  it("ends the run without a queue failure when a unit fails after the supersession", async () => {
    const { accountId, curationId } = await curated();
    model.script(["answer", "answer", "answer", "timeout"]);
    model.beforeCall = async (callNumber) => {
      if (callNumber === 4) {
        await built(accountId, "kenji-single-column-en");
      }
    };

    await expect(runner.run(curationId)).resolves.toBeUndefined();

    expect(model.calls).toHaveLength(4);
    expect(await curationOf(curationId)).toMatchObject({ status: "superseded", failure_reason: null });
    expect(await statementsOf(accountId)).toEqual([]);
  });

  it("lets the next confirm start a fresh Curation for the new Profile", async () => {
    const { accountId, curationId } = await curated();

    const newIngestionId = await built(accountId, "kenji-single-column-en");

    expect((await curationOf(curationId)).status).toBe("superseded");
    expect((await profiles.get(accountId)).confirmedAt).toBeNull();

    await profiles.confirm(accountId);

    const active = await database.selectFrom("curations").selectAll().where("account_id", "=", accountId).where("status", "=", "queued").execute();

    expect(active).toMatchObject([{ source_ingestion_id: newIngestionId }]);
  });

  it("logs the superseded Curation by its ids only", async () => {
    const { curationId, accountId } = await curated();
    const lines: string[] = [];
    vi.spyOn(Logger.prototype, "log").mockImplementation((message: unknown) => void lines.push(String(message)));

    const newIngestionId = await built(accountId, "kenji-single-column-en");

    expect(lines).toContain(`curation superseded curation=${curationId} ingestion=${newIngestionId}`);
  });
});
