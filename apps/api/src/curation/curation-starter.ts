import { Injectable, Logger } from "@nestjs/common";
import type { Curation, Id } from "@helpmegethired/shared";

import { lockAccount } from "../database/account-lock";
import type { Database } from "../database/database";
import { TransactionRunner } from "../database/transaction-runner";
import { CURATION_MAX_ATTEMPTS } from "./curation-job-options";
import { CurationQueue } from "./curation-queue";
import { unitsOf } from "./curation-units";
import { CurationRepository } from "./curation.repository";

// Every Statement records the prompt version it was written under, so a change to any unit's
// prompt bumps this: it is how an already-curated Candidate is told apart (ADR-0024).
export const CURATION_PROMPT_VERSION = "curation/1";

export type TriggeringWrite<Result> = (transaction: Database) => Promise<Result>;

@Injectable()
export class CurationStarter {
  private readonly logger = new Logger(CurationStarter.name);

  constructor(
    private readonly transactions: TransactionRunner,
    private readonly curations: CurationRepository,
    private readonly queue: CurationQueue,
  ) {}

  // Confirming the Profile and storing a Model Key both run through here, whichever comes last
  // starting the Curation (ADR-0024). The write and the Curation it completes commit together
  // under the Account lock, so a failure in either rolls back both and two requests cannot both
  // create one; the job is added after the commit.
  async commitAndStart<Result>(accountId: Id, write: TriggeringWrite<Result>): Promise<Result> {
    const { result, curation } = await this.transactions.run(async (transaction) => {
      await lockAccount(accountId, transaction);

      const written = await write(transaction);

      return { result: written, curation: await this.createIfReady(accountId, transaction) };
    });

    if (curation) {
      await this.enqueue(curation);
    }

    return result;
  }

  // An active Curation of an earlier Ingestion keeps the Account until a new Ingestion supersedes
  // it (#116); until then nothing new is created beside it.
  private async createIfReady(accountId: Id, transaction: Database): Promise<Curation | undefined> {
    const readiness = await this.curations.readinessOf(accountId, transaction);

    if (!readiness) {
      return undefined;
    }

    const existing =
      (await this.curations.findCurrentFor(accountId, readiness.ingestionId, transaction)) ?? (await this.curations.findActive(accountId, transaction));

    if (existing) {
      return undefined;
    }

    const units = unitsOf(await this.curations.subjectsOf(accountId, readiness.ingestionId, transaction));
    const curation = await this.curations.create(
      accountId,
      { sourceIngestionId: readiness.ingestionId, modelId: readiness.modelId, promptVersion: CURATION_PROMPT_VERSION, maxAttempts: CURATION_MAX_ATTEMPTS, units },
      transaction,
    );

    this.logger.log(`Curation ${curation.id} created for Account ${accountId} with ${units.length} units`);

    return curation;
  }

  // The row is committed before the job is added, so a queue outage leaves a queued Curation
  // without a job for reconciliation (#115) instead of failing the request.
  private async enqueue(curation: Curation): Promise<void> {
    try {
      await this.queue.enqueue({ curationId: curation.id, maxAttempts: curation.maxAttempts });
    } catch (error) {
      this.logger.error(`Curation ${curation.id} is queued but its job could not be added`, error);
    }
  }
}
