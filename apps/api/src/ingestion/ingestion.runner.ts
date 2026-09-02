import { Injectable, Logger } from "@nestjs/common";
import type { Id, Ingestion, SegmentStep } from "@helpmegethired/shared";

import { IngestionNotFoundError } from "./ingestion-errors";
import { IngestionRepository } from "./ingestion.repository";
import type { Segment } from "./segment";
import type { AnySegmentProcessor, SegmentContext } from "./segment-processor";
import { SegmentProcessorRegistry } from "./segment-processor.registry";
import { stepsRemainingFor } from "./segment-state";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Injectable()
export class IngestionRunner {
  private readonly logger = new Logger(IngestionRunner.name);

  constructor(
    private readonly repository: IngestionRepository,
    private readonly processors: SegmentProcessorRegistry,
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

      await this.repository.completeAttempt(ingestionId);
    } catch (error) {
      const failed = await this.repository.failAttempt(ingestionId, messageOf(error));

      this.logger.warn(
        `Ingestion ${ingestionId} failed on attempt ${ingestion.attempts} of ${ingestion.maxAttempts}; ` +
          `now ${failed?.status ?? "unknown"}`,
      );

      throw error;
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
