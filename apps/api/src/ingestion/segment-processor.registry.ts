import { Inject, Injectable } from "@nestjs/common";

import { UnknownSegmentKindError } from "./ingestion-errors";
import { SEGMENT_PROCESSORS, type AnySegmentProcessor } from "./segment-processor";

@Injectable()
export class SegmentProcessorRegistry {
  private readonly byKind = new Map<string, AnySegmentProcessor>();

  constructor(@Inject(SEGMENT_PROCESSORS) processors: AnySegmentProcessor[]) {
    for (const processor of processors) {
      this.register(processor);
    }
  }

  register(processor: AnySegmentProcessor): void {
    if (this.byKind.has(processor.kind)) {
      throw new Error(`A SegmentProcessor for the kind "${processor.kind}" is already registered`);
    }

    this.byKind.set(processor.kind, processor);
  }

  processorFor(kind: string): AnySegmentProcessor {
    const processor = this.byKind.get(kind);

    if (!processor) {
      throw new UnknownSegmentKindError(kind);
    }

    return processor;
  }
}
