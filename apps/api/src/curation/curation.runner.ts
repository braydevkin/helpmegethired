import { performance } from "node:perf_hooks";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CurationMetrics, CurationUnitOutput, Id } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import type { CurationUnitRow } from "../database/database.schema";
import { ModelKeyNotFoundError } from "../model-choice/model-choice-errors";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import type { UsableModelKey } from "../model-choice/model-key";
import { CurationAttemptFailedError, CurationNotFoundError } from "./curation-errors";
import { curationMetricsOf } from "./curation-metrics";
import { instructionsFor } from "./curation-prompts";
import { CurationRunRepository, type CuratedProfile, type CurationRun, type NewStatement } from "./curation-run.repository";
import { CURATION_RUNNER_SETTINGS, type CurationRunnerSettings } from "./curation-runner-settings";
import { CURATION_PROMPT_VERSION } from "./curation-starter";
import { citableKey, resolveEvidence, type CitableTexts } from "./evidence-resolution";
import { CurationModel, type TokenUsage } from "./model/curation-model";
import { CurationCallFailedError, ModelKeyRejectedError, ProviderRateLimitedError } from "./model/curation-model-errors";
import { runConcurrently } from "./run-concurrently";
import { cappedInput, sourcesOf } from "./unit-input";

// How long a rate-limited Curation waits when the Provider sends no retry-after.
export const DEFAULT_PAUSE_SECONDS = 60;

type UnitOutcome = { kind: "saved" } | { kind: "failed" } | { kind: "stopped" } | { kind: "paused"; retryAfterSeconds: number | null } | { kind: "key_rejected" };

type Verdict = UnitOutcome | { kind: "continue" };

interface RunContext {
  run: CurationRun;
  key: UsableModelKey;
  profile: CuratedProfile;
  facts: CurationMetrics;
  texts: CitableTexts;
  notes?: readonly string[];
}

const SAVED: UnitOutcome = { kind: "saved" };
const FAILED: UnitOutcome = { kind: "failed" };
const STOPPED: UnitOutcome = { kind: "stopped" };

const halts = (outcome: UnitOutcome): boolean => outcome.kind === "stopped" || outcome.kind === "paused" || outcome.kind === "key_rejected";

// A unit that stops, pauses, or loses the key decides for the whole run; otherwise one failed unit
// fails the attempt, and a run whose every unit saved goes on.
function verdictOf(outcomes: readonly UnitOutcome[]): Verdict {
  return outcomes.find(halts) ?? outcomes.find((outcome) => outcome.kind === "failed") ?? { kind: "continue" };
}

function citableTextsOf(profile: CuratedProfile): CitableTexts {
  const texts = new Map<string, string>();

  for (const experience of profile.experiences) {
    texts.set(citableKey("experience", experience.id), experience.description ?? "");
  }

  for (const project of profile.projects) {
    texts.set(citableKey("project", project.id), project.description ?? "");
  }

  if (profile.uploadedResume) {
    texts.set(citableKey("text_span", profile.uploadedResume.id), profile.uploadedResume.text);
  }

  return texts;
}

@Injectable()
export class CurationRunner {
  private readonly logger = new Logger(CurationRunner.name);

  constructor(
    private readonly runs: CurationRunRepository,
    private readonly model: CurationModel,
    private readonly keys: ModelChoiceService,
    private readonly clock: Clock,
    @Inject(CURATION_RUNNER_SETTINGS) private readonly settings: CurationRunnerSettings,
  ) {}

  // A retry calls the same method and pays only for what is left.
  async run(curationId: Id): Promise<void> {
    const run = await this.runs.beginAttempt(curationId);

    if (!run) {
      return this.settleUnstartable(curationId);
    }

    const context = await this.contextOf(run);

    if (context) {
      await this.settle(run, verdictOf(await this.runPending(context)));
    }
  }

  private async contextOf(run: CurationRun): Promise<RunContext | undefined> {
    const key = await this.usableKeyOf(run);

    if (!key) {
      return undefined;
    }

    const profile = await this.runs.profileOf(run);

    return { run, key, profile, facts: curationMetricsOf(profile, this.clock.now()), texts: citableTextsOf(profile) };
  }

  // Every unit not yet saved, three at a time, then the synthesis unit alone once every other one
  // is saved, since it reads what they produced.
  private async runPending(context: RunContext): Promise<UnitOutcome[]> {
    const pending = (await this.runs.unitsOf(context.run.id)).filter((unit) => unit.status !== "saved");
    const synthesis = pending.find((unit) => unit.kind === "synthesis");
    const outcomes = await runConcurrently(
      pending.filter((unit) => unit !== synthesis),
      this.settings.unitConcurrency,
      (unit) => this.runUnit(unit, context),
      halts,
    );

    if (synthesis && verdictOf(outcomes).kind === "continue") {
      outcomes.push(await this.runUnit(synthesis, { ...context, notes: await this.runs.savedStatementsOf(context.run.id) }));
    }

    return outcomes;
  }

  private async settle(run: CurationRun, verdict: Verdict): Promise<void> {
    switch (verdict.kind) {
      case "paused": {
        const resumeAfter = new Date(this.clock.now().getTime() + (verdict.retryAfterSeconds ?? DEFAULT_PAUSE_SECONDS) * 1000);

        await this.runs.pause(run.id, resumeAfter);
        this.logger.log(`curation paused curation=${run.id} resume_after=${resumeAfter.toISOString()}`);

        return;
      }
      case "key_rejected":
        await this.runs.failWith(run.id, "model_key_rejected");
        this.logger.warn(`curation failed curation=${run.id} reason=model_key_rejected`);

        return;
      case "failed": {
        const status = await this.runs.failAttempt(run.id);

        this.logger.warn(`curation attempt failed curation=${run.id} attempt=${run.attempts} of=${run.maxAttempts} now=${status ?? "unknown"}`);

        throw new CurationAttemptFailedError(run.id, status);
      }
      case "stopped":
        this.logger.log(`curation stopped curation=${run.id}`);

        return;
      default: {
        const completed = await this.runs.completeAttempt(run.id);

        this.logger.log(`curation ${completed ? "completed" : "stopped"} curation=${run.id}`);
      }
    }
  }

  // A job for a Curation that cannot start: already ended, paused until later, or with every
  // attempt used, which a run killed after its last start leaves behind.
  private async settleUnstartable(curationId: Id): Promise<void> {
    const row = await this.runs.findById(curationId);

    if (!row) {
      throw new CurationNotFoundError(curationId);
    }

    if ((row.status === "queued" || row.status === "running") && row.attempts >= row.max_attempts) {
      await this.runs.failWith(curationId, "attempts_exhausted");
      this.logger.warn(`curation failed curation=${curationId} reason=attempts_exhausted`);
    }
  }

  private async usableKeyOf(run: CurationRun): Promise<UsableModelKey | undefined> {
    try {
      return await this.keys.usableModelKey(run.accountId);
    } catch (error) {
      if (!(error instanceof ModelKeyNotFoundError)) {
        throw error;
      }

      await this.runs.failWith(run.id, "model_key_rejected");
      this.logger.warn(`curation failed curation=${run.id} reason=model_key_rejected`);

      return undefined;
    }
  }

  private async runUnit(unit: CurationUnitRow, context: RunContext): Promise<UnitOutcome> {
    if ((await this.runs.statusOf(context.run.id)) !== "running") {
      return STOPPED;
    }

    const input = cappedInput(sourcesOf({ kind: unit.kind, subjectId: unit.subject_id }, context.profile));

    await this.runs.beginUnit(unit.id, input.truncated);

    const started = performance.now();
    let answer: { output: CurationUnitOutput; usage: TokenUsage };

    try {
      answer = await this.model.generate({
        prompt: { version: CURATION_PROMPT_VERSION, instructions: instructionsFor(unit.kind), facts: context.facts, sources: input.sources, notes: context.notes },
        modelId: context.run.modelId,
        modelKey: context.key.key,
      });
    } catch (error) {
      return this.unitFailure(unit, context.run, error, started);
    }

    const saved = await this.runs.saveUnit(context.run, unit.id, this.resolvedStatements(unit, context, answer.output), CURATION_PROMPT_VERSION);

    this.logCall(context.run, unit, answer.usage, started, "ok");

    return saved ? SAVED : STOPPED;
  }

  private async unitFailure(unit: CurationUnitRow, run: CurationRun, error: unknown, started: number): Promise<UnitOutcome> {
    if (error instanceof ProviderRateLimitedError) {
      await this.runs.releaseUnit(unit.id);
      this.logCall(run, unit, null, started, "rate_limited");

      return { kind: "paused", retryAfterSeconds: error.retryAfterSeconds };
    }

    if (error instanceof ModelKeyRejectedError) {
      await this.runs.failUnit(unit.id, "provider_error");
      this.logCall(run, unit, null, started, "key_rejected");

      return { kind: "key_rejected" };
    }

    const failure = error instanceof CurationCallFailedError ? error : new CurationCallFailedError("provider_error");

    await this.runs.failUnit(unit.id, failure.outcome);
    this.logCall(run, unit, failure.usage, started, failure.outcome);

    return FAILED;
  }

  private resolvedStatements(unit: CurationUnitRow, context: RunContext, output: CurationUnitOutput): NewStatement[] {
    return output.statements.flatMap(({ text, labels, evidence: citations }) => {
      const evidence = resolveEvidence(citations, context.texts);

      if (!evidence) {
        this.logger.warn(`curation statement discarded curation=${context.run.id} unit=${unit.id} reason=evidence_unresolved`);

        return [];
      }

      return [{ text, labels, evidence }];
    });
  }

  // One line per model call (docs/security.md, "AI pipeline"): ids, the Model, the prompt version,
  // the tokens, the latency, and the outcome, never the prompt or the answer.
  private logCall(run: CurationRun, unit: CurationUnitRow, usage: TokenUsage | null, started: number, outcome: string): void {
    this.logger.log(
      `curation call account=${run.accountId} curation=${run.id} unit=${unit.id} kind=${unit.kind} model=${run.modelId} prompt=${CURATION_PROMPT_VERSION} ` +
        `input_tokens=${usage?.inputTokens ?? 0} output_tokens=${usage?.outputTokens ?? 0} latency_ms=${Math.round(performance.now() - started)} outcome=${outcome}`,
    );
  }
}
