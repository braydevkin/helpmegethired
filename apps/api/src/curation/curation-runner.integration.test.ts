import { randomUUID } from "node:crypto";

import { Logger, type INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { EvidenceSchema, type Evidence, type Id } from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { ProfileModule } from "../profile/profile.module";
import { ProfileService } from "../profile/profile.service";
import { QUEUE_PREFIX } from "../queue/queues";
import { CurationAttemptFailedError } from "./curation-errors";
import { CurationQueue } from "./curation-queue";
import { CURATION_RUNNER_SETTINGS } from "./curation-runner-settings";
import { CurationRunnerModule } from "./curation-runner.module";
import { CURATION_PROMPT_VERSION } from "./curation-starter";
import { CurationRunner } from "./curation.runner";
import { CurationModel, type CurationAnswer, type CurationCall } from "./model/curation-model";
import { FakeCurationModel, type FakeCurationOutcome } from "./model/fake-curation-model";

// The deterministic fake from #111, wrapped so a test can script its outcomes, act at a call
// boundary, or hand-write an answer. No test reaches a Provider.
class ScriptedModel extends CurationModel {
  readonly calls: CurationCall[] = [];
  onCall: (call: CurationCall) => Promise<void> = () => Promise.resolve();
  answerWith: ((call: CurationCall) => CurationAnswer) | undefined;
  private fake = new FakeCurationModel();

  script(outcomes: readonly FakeCurationOutcome[]): void {
    this.fake = new FakeCurationModel(outcomes);
  }

  reset(): void {
    this.calls.length = 0;
    this.onCall = () => Promise.resolve();
    this.answerWith = undefined;
    this.fake = new FakeCurationModel();
  }

  async generate(call: CurationCall): Promise<CurationAnswer> {
    this.calls.push(call);
    await this.onCall(call);

    return this.answerWith ? this.answerWith(call) : this.fake.generate(call);
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

const descriptionOf = (index: number) => `Moved the build cache to object storage for team ${index}. Runs the deployment platform.`;

describe("the Curation runner", () => {
  let context: INestApplicationContext;
  let database: Database;
  let runner: CurationRunner;
  let profiles: ProfileService;
  let choices: ModelChoiceService;
  const model = new ScriptedModel();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileModule, CurationRunnerModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(CurationQueue)
      .useValue(new IdleQueue())
      .overrideProvider(CurationModel)
      .useValue(model)
      .overrideProvider(CURATION_RUNNER_SETTINGS)
      .useValue({ unitConcurrency: 1 })
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    runner = context.get(CurationRunner);
    profiles = context.get(ProfileService);
    choices = context.get(ModelChoiceService);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    model.reset();
    vi.restoreAllMocks();
  });

  interface Curated {
    accountId: Id;
    curationId: Id;
    ingestionId: Id;
    modelKey: string;
  }

  // A confirmed Profile with a stored Model Key, which is what leaves a queued Curation (#112).
  async function queuedCuration({ experiences = 2, projects = 1, description = descriptionOf } = {}): Promise<Curated> {
    const { id: accountId } = await database.insertInto("accounts").values({ email: `${randomUUID()}@candidate.example` }).returning("id").executeTakeFirstOrThrow();
    const { id: ingestionId } = await database
      .insertInto("ingestions")
      .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
      .returning("id")
      .executeTakeFirstOrThrow();
    const { id: segmentId } = await database
      .insertInto("ingestion_segments")
      .values({ ingestion_id: ingestionId, position: 0, kind: "experience", status: "saved", input: "{}" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const rowOf = (position: number) => ({ account_id: accountId, source_ingestion_id: ingestionId, segment_id: segmentId, segment_position: 0, position });

    await database.insertInto("basic_profiles").values({ account_id: accountId, source_ingestion_id: ingestionId, segment_id: segmentId }).execute();

    for (let index = 0; index < experiences; index += 1) {
      await database
        .insertInto("experiences")
        .values({ ...rowOf(index), role: `Platform Engineer ${index}`, company: "Parapet Systems", period_start: "2020-01", period_end: "2021-12", description: description(index), skills: "[]" })
        .execute();
    }

    for (let index = 0; index < projects; index += 1) {
      await database.insertInto("projects").values({ ...rowOf(index), name: `Bastion ${index}`, description: `Rotates short-lived credentials ${index}.`, skills: "[]" }).execute();
    }

    const modelKey = `sk-ant-api03-candidate-${randomUUID()}`;

    await choices.save(accountId, { provider: "anthropic", modelId: "claude-sonnet-5", key: modelKey });
    await profiles.confirm(accountId);

    const { id: curationId } = await database.selectFrom("curations").select("id").where("account_id", "=", accountId).executeTakeFirstOrThrow();

    return { accountId, curationId, ingestionId, modelKey };
  }

  const curationOf = (id: Id) => database.selectFrom("curations").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  const unitsOf = (id: Id) => database.selectFrom("curation_units").selectAll().where("curation_id", "=", id).orderBy("position").execute();
  const statementsOf = (id: Id) => database.selectFrom("statements").selectAll().where("curation_id", "=", id).orderBy("created_at").orderBy("id").execute();
  const calledKinds = () => model.calls.map((call) => (call.prompt.notes ? "synthesis" : call.prompt.sources.length > 1 ? "cross_cutting" : call.prompt.sources[0]?.kind));

  it("curates every unit, the synthesis unit last, into Statements whose Evidence resolves, then completes", async () => {
    const { curationId, ingestionId, modelKey } = await queuedCuration();
    const experiences = await database.selectFrom("experiences").select(["id", "description"]).where("source_ingestion_id", "=", ingestionId).execute();

    await runner.run(curationId);

    expect(await curationOf(curationId)).toMatchObject({ status: "completed", attempts: 1, failure_reason: null });
    expect((await unitsOf(curationId)).map((unit) => [unit.kind, unit.status])).toEqual([
      ["experience", "saved"],
      ["experience", "saved"],
      ["project", "saved"],
      ["cross_cutting", "saved"],
      ["synthesis", "saved"],
    ]);
    expect(calledKinds()).toEqual(["experience", "experience", "project", "cross_cutting", "synthesis"]);
    expect(model.calls.every((call) => call.modelKey.reveal() === modelKey && call.modelId === "claude-sonnet-5")).toBe(true);
    expect(model.calls.every((call) => call.prompt.facts.counts.roles === 2 && call.prompt.facts.careerDuration.years === 2)).toBe(true);
    expect(model.calls.at(-1)?.prompt.notes?.length).toBeGreaterThan(0);

    const statements = await statementsOf(curationId);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatchObject({ prompt_version: CURATION_PROMPT_VERSION, model_id: "claude-sonnet-5", source_ingestion_id: ingestionId, review_state: "unreviewed" });

      for (const evidence of statement.evidence as Evidence[]) {
        expect(EvidenceSchema.parse(evidence)).toEqual(evidence);
        if (evidence.kind === "experience") {
          expect(experiences.find((experience) => experience.id === evidence.referenceId)?.description?.slice(evidence.start, evidence.end)).toBe(evidence.quote);
        }
      }
    }
  });

  it("fails only the unit whose answer fails the schema, then resumes at it without redoing a saved one", async () => {
    const { curationId } = await queuedCuration();
    model.script(["answer", "invalid_output"]);

    await expect(runner.run(curationId)).rejects.toBeInstanceOf(CurationAttemptFailedError);

    expect(await curationOf(curationId)).toMatchObject({ status: "queued", attempts: 1 });
    expect((await unitsOf(curationId)).map((unit) => [unit.status, unit.failure_reason])).toEqual([
      ["saved", null],
      ["failed", "invalid_output"],
      ["saved", null],
      ["saved", null],
      ["pending", null],
    ]);
    expect(calledKinds()).not.toContain("synthesis");

    const savedBefore = (await statementsOf(curationId)).map((statement) => statement.id);
    model.reset();

    await runner.run(curationId);

    expect(calledKinds()).toEqual(["experience", "synthesis"]);
    expect(await curationOf(curationId)).toMatchObject({ status: "completed", attempts: 2 });
    expect((await statementsOf(curationId)).map((statement) => statement.id)).toEqual(expect.arrayContaining(savedBefore));
  });

  it("discards a Statement whose Evidence does not resolve, and logs the unit", async () => {
    const { curationId } = await queuedCuration({ experiences: 1, projects: 0 });
    const warned = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    model.answerWith = (call) => {
      const source = call.prompt.sources[0]!;

      return {
        output: {
          statements: [
            { text: "Moved the build cache to object storage.", labels: ["platform"], evidence: [{ kind: source.kind, referenceId: source.referenceId, quote: "Moved the build cache" }] },
            { text: "Led a team of 50 engineers at Google.", labels: ["leadership"], evidence: [{ kind: source.kind, referenceId: source.referenceId, quote: "Led a team of 50 at Google." }] },
          ],
        },
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    };

    await runner.run(curationId);

    const texts = (await statementsOf(curationId)).map((statement) => statement.text);
    const [experienceUnit] = await unitsOf(curationId);

    expect(texts).not.toContain("Led a team of 50 engineers at Google.");
    expect(texts).toContain("Moved the build cache to object storage.");
    expect(warned).toHaveBeenCalledWith(`curation statement discarded curation=${curationId} unit=${experienceUnit?.id} reason=evidence_unresolved`);
  });

  it.each(["cancelled", "superseded"] as const)("stops cleanly at the next unit boundary once the Curation is %s", async (status) => {
    const { curationId } = await queuedCuration();
    model.onCall = async () => {
      await database.updateTable("curations").set({ status }).where("id", "=", curationId).execute();
    };

    await expect(runner.run(curationId)).resolves.toBeUndefined();

    expect(model.calls).toHaveLength(1);
    expect((await curationOf(curationId)).status).toBe(status);
    expect(await statementsOf(curationId)).toEqual([]);
  });

  it("fails the Curation with a readable reason when its last attempt fails", async () => {
    const { curationId } = await queuedCuration({ experiences: 1, projects: 0 });
    await database.updateTable("curations").set({ attempts: 2 }).where("id", "=", curationId).execute();
    model.script(["timeout"]);

    await expect(runner.run(curationId)).rejects.toBeInstanceOf(CurationAttemptFailedError);

    expect(await curationOf(curationId)).toMatchObject({ status: "failed", attempts: 3, failure_reason: "attempts_exhausted" });
  });

  it("fails a Curation left with every attempt used, without calling the model", async () => {
    const { curationId } = await queuedCuration({ experiences: 1, projects: 0 });
    await database.updateTable("curations").set({ status: "running", attempts: 3 }).where("id", "=", curationId).execute();

    await runner.run(curationId);

    expect(model.calls).toEqual([]);
    expect(await curationOf(curationId)).toMatchObject({ status: "failed", failure_reason: "attempts_exhausted" });
  });

  it("pauses on a Provider rate limit until resume_after, giving the attempt back", async () => {
    const { curationId } = await queuedCuration();
    model.script(["rate_limited"]);

    await expect(runner.run(curationId)).resolves.toBeUndefined();

    const paused = await curationOf(curationId);
    expect(paused).toMatchObject({ status: "queued", attempts: 0 });
    expect(paused.resume_after?.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect((await unitsOf(curationId))[0]).toMatchObject({ status: "pending", attempts: 0 });
    expect(model.calls).toHaveLength(1);

    model.reset();
    await runner.run(curationId);

    expect(model.calls).toEqual([]);
  });

  it.each([
    ["a key the Provider refuses", async () => model.script(["key_rejected"])],
    ["a key revoked before the run", async (accountId: Id) => void (await choices.revokeKey(accountId))],
  ])("fails the Curation on %s", async (_label, arrange) => {
    const { accountId, curationId } = await queuedCuration({ experiences: 1, projects: 0 });
    await arrange(accountId);

    await runner.run(curationId);

    expect(await curationOf(curationId)).toMatchObject({ status: "failed", failure_reason: "model_key_rejected" });
  });

  it("records a unit whose input was cut at the cap", async () => {
    const long = () => Array.from({ length: 400 }, (_, line) => `Line ${line} of a long account of the platform work.`).join("\n");
    const { curationId } = await queuedCuration({ experiences: 1, projects: 0, description: long });

    await runner.run(curationId);

    const [experienceUnit] = await unitsOf(curationId);
    const sent = model.calls[0]?.prompt.sources[0];

    expect(experienceUnit?.truncated).toBe(true);
    expect((sent?.title.length ?? 0) + (sent?.text.length ?? 0)).toBeLessThanOrEqual(8000);
  });

  it("logs each call by its ids and tokens, and never the Candidate's text or key", async () => {
    const { curationId, modelKey } = await queuedCuration({ experiences: 1, projects: 0 });
    const lines: string[] = [];
    vi.spyOn(Logger.prototype, "log").mockImplementation((message: unknown) => void lines.push(String(message)));

    await runner.run(curationId);

    const calls = lines.filter((line) => line.startsWith("curation call "));
    expect(calls).toHaveLength(3);
    for (const line of calls) {
      expect(line).toMatch(new RegExp(`curation=${curationId} unit=\\S+ kind=\\S+ model=claude-sonnet-5 prompt=${CURATION_PROMPT_VERSION} input_tokens=\\d+ output_tokens=\\d+ latency_ms=\\d+ outcome=ok`));
      expect(line).not.toContain("build cache");
      expect(line).not.toContain(modelKey);
    }
  });
});
