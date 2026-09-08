import { Injectable, Logger } from "@nestjs/common";
import type { Id, Ingestion, SegmentStep } from "@helpmegethired/shared";

import { TransactionRunner } from "../database/transaction-runner";
import { IngestionNotFoundError } from "./ingestion-errors";
import { IngestionObservers } from "./ingestion-observer";
import { IngestionRunRepository } from "./ingestion-run.repository";
import type { Segment } from "./segment";
import type { AnySegmentProcessor, SegmentContext } from "./segment-processor";
import { SegmentProcessorRegistry } from "./segment-processor.registry";
import { stepsRemainingFor } from "./segment-state";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Injectable()
export class IngestionRunner {
  private readonly logger = new Logger(IngestionRunner.name);

  constructor(
    private readonly repository: IngestionRunRepository,
    private readonly processors: SegmentProcessorRegistry,
    private readonly observers: IngestionObservers,
    private readonly transactions: TransactionRunner,
  ) {}

  async run(ingestionId: Id): Promise<void> {
    const ingestion = await this.repository.beginAttempt(ingestionId);

    if (!ingestion) {
      await this.assertKnown(ingestionId);

      return;
    }

    try {
      for (const segment of await this.repository.segmentsOf(ingestionId)) {
        await this.completeSegment(segment, ingestion);
      }

      await this.complete(ingestionId);
    } catch (error) {
      await this.fail(ingestion, error);

      throw error;
    }
  }

  // The completion and what follows it, such as replacing the previous Profile, are one
  // transaction: a crash in between leaves the Ingestion running for the next attempt.
  private complete(ingestionId: Id): Promise<void> {
    return this.transactions.run(async (transaction) => {
      const completed = await this.repository.completeAttempt(ingestionId, transaction);

      await this.observers.completed(completed, transaction);
    });
  }

  private async fail(ingestion: Ingestion, error: unknown): Promise<void> {
    const failed = await this.repository.failAttempt(ingestion.id, messageOf(error));

    this.logger.warn(
      `Ingestion ${ingestion.id} failed on attempt ${ingestion.attempts} of ${ingestion.maxAttempts}; ` +
        `now ${failed?.status ?? "unknown"}`,
    );

    if (failed?.status === "failed") {
      await this.observers.failed(failed);
    }
  }

  private async assertKnown(ingestionId: Id): Promise<void> {
    if (!(await this.repository.findById(ingestionId))) {
      throw new IngestionNotFoundError(ingestionId);
    }
  }

  private async completeSegment(segment: Segment, ingestion: Ingestion): Promise<void> {
    const processor = this.processors.processorFor(segment.kind);
    const context: SegmentContext = {
      ingestionId: ingestion.id,
      accountId: ingestion.accountId,
      segmentId: segment.id,
      position: segment.position,
    };

    let current = segment;

    try {
      for (const step of stepsRemainingFor(current.status)) {
        current = await this.runStep(step, current, processor, context);
      }
    } catch (error) {
      await this.repository.recordSegmentError(current.id, messageOf(error));

      throw error;
    }
  }

  private async runStep(
    step: SegmentStep,
    segment: Segment,
    processor: AnySegmentProcessor,
    context: SegmentContext,
  ): Promise<Segment> {
    switch (step) {
      case "read":
        return this.repository.recordStep(segment.id, step, await processor.read(segment.input, context));
      case "recognize":
        return this.repository.recordStep(segment.id, step, await processor.recognize(segment.content, context));
      case "save":
        await processor.save(segment.recognized, context);

        return this.repository.recordStep(segment.id, step, undefined);
    }
  }
}
