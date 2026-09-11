import { Injectable, Logger } from "@nestjs/common";
import type { CurationStatus, Id } from "@helpmegethired/shared";

import type { Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import { TransactionRunner } from "../database/transaction-runner";
import { CurationActionRefusedError } from "./curation-errors";
import { CURATION_PROMPT_VERSION, CurationStarter, type EnqueuedCuration } from "./curation-starter";
import { CurationRepository, type CurationReadiness } from "./curation.repository";
import { isRerunAllowed } from "./rerun-gate";

const ONE_ACTIVE_PER_ACCOUNT_INDEX = "curations_one_active_per_account_idx";

const RETRYABLE_STATUSES: readonly CurationStatus[] = ["failed", "cancelled"];

const activeRefusal = () => new CurationActionRefusedError("curation_active", "A Curation is already queued or running");

// What the Candidate can do to a Curation from the analysis page. Stopping and retrying cost almost
// nothing because the runner resumes; a re-run starts from zero on the Candidate's tokens, so it
// is gated (ADR-0024).
@Injectable()
export class CurationActions {
  private readonly logger = new Logger(CurationActions.name);

  constructor(
    private readonly transactions: TransactionRunner,
    private readonly curations: CurationRepository,
    private readonly starter: CurationStarter,
  ) {}

  // The runner stops at its next unit boundary; the saved Statements stay for a retry, and nothing
  // is indexed.
  async cancel(accountId: Id): Promise<void> {
    const cancelled = await this.transactions.run(async (transaction) => {
      await this.curations.lockForChange(accountId, transaction);

      const active = await this.curations.findActive(accountId, transaction);

      if (!active) {
        throw new CurationActionRefusedError("curation_not_found", "No Curation is queued or running");
      }

      await this.curations.cancel(accountId, active.id, transaction);

      return active;
    });

    this.logger.log(`curation cancelled curation=${cancelled.id}`);
  }

  // The same Curation goes back to the queue under the same job id, with its saved units kept. One
  // produced under another Model would mix two Models' Statements, so it is re-run instead.
  async retry(accountId: Id): Promise<void> {
    const retried = await this.startingWork(accountId, async (transaction, readiness) => {
      const latest = await this.curations.findLatestOf(accountId, readiness.ingestionId, transaction);

      if (!latest) {
        throw new CurationActionRefusedError("curation_not_found", "The Profile has no Curation to retry");
      }

      if (!RETRYABLE_STATUSES.includes(latest.status)) {
        throw new CurationActionRefusedError("curation_not_retryable", "Only a failed or cancelled Curation can be retried");
      }

      if (latest.modelId !== readiness.modelId) {
        throw new CurationActionRefusedError("curation_model_changed", "The Model Choice changed since this Curation started; run it again instead");
      }

      await this.curations.requeue(accountId, latest.id, transaction);

      return latest;
    });

    this.logger.log(`curation retried curation=${retried.id}`);
  }

  // The new Curation builds beside the current completed one, which stays retrievable until the new
  // one completes and supersedes it.
  async rerun(accountId: Id): Promise<void> {
    const created = await this.startingWork(accountId, async (transaction, readiness) => {
      const latest = await this.curations.findLatestOf(accountId, readiness.ingestionId, transaction);
      const current = await this.curations.findCurrentCompleted(accountId, transaction);
      const wanted = { sourceIngestionId: readiness.ingestionId, modelId: readiness.modelId, promptVersion: CURATION_PROMPT_VERSION };

      if (!isRerunAllowed(latest, current, wanted)) {
        throw new CurationActionRefusedError(
          "curation_unchanged",
          "The Curation already completed for this Profile, Model, and prompt version; running it again would produce the same Statements",
        );
      }

      return this.starter.createFrom(accountId, readiness, transaction);
    });

    this.logger.log(`curation re-run curation=${created.id}`);
  }

  // Retry and re-run both start work, so either is refused while a Curation is queued or running.
  // Two requests serialise on the locks and the second sees the first one's Curation; the partial
  // unique index is the backstop.
  private async startingWork(accountId: Id, work: (transaction: Database, readiness: CurationReadiness) => Promise<EnqueuedCuration>): Promise<EnqueuedCuration> {
    let started: EnqueuedCuration;

    try {
      started = await this.transactions.run(async (transaction) => {
        await this.curations.lockForChange(accountId, transaction);

        if (await this.curations.findActive(accountId, transaction)) {
          throw activeRefusal();
        }

        const readiness = await this.curations.readinessOf(accountId, transaction);

        if (!readiness) {
          throw new CurationActionRefusedError("curation_not_ready", "The Profile must be confirmed and a Model Key stored first");
        }

        return work(transaction, readiness);
      });
    } catch (error) {
      throw isUniqueViolation(error, ONE_ACTIVE_PER_ACCOUNT_INDEX) ? activeRefusal() : error;
    }

    await this.starter.enqueue(started);

    return started;
  }
}
