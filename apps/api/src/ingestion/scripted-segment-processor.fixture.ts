import type { SegmentStep } from "@helpmegethired/shared";

import { SegmentProcessor, type SegmentContext } from "./segment-processor";

export interface SegmentInput {
  text: string;
}

export interface SegmentContent {
  words: string[];
}

export interface RecognizedSegment {
  summary: string;
}

export interface StepCall {
  step: SegmentStep;
  position: number;
}

export class ScriptedSegmentProcessor extends SegmentProcessor<SegmentInput, SegmentContent, RecognizedSegment> {
  readonly kind = "scripted";
  readonly calls: StepCall[] = [];
  readonly saved = new Map<number, RecognizedSegment>();
  private readonly pendingFailures: StepCall[] = [];
  private readonly pendingHangs: StepCall[] = [];

  failOnceAt(step: SegmentStep, position: number): this {
    this.pendingFailures.push({ step, position });

    return this;
  }

  // A Step that never settles stands in for a worker killed mid-run: the job keeps its lock
  // until it expires and is re-delivered elsewhere.
  hangOnceAt(step: SegmentStep, position: number): this {
    this.pendingHangs.push({ step, position });

    return this;
  }

  hasReached(step: SegmentStep, position: number): boolean {
    return this.calls.some((call) => call.step === step && call.position === position);
  }

  read(input: SegmentInput, context: SegmentContext): Promise<SegmentContent> {
    return this.settle("read", context, () => ({ words: input.text.split(" ") }));
  }

  recognize(content: SegmentContent, context: SegmentContext): Promise<RecognizedSegment> {
    return this.settle("recognize", context, () => ({ summary: content.words.join("-") }));
  }

  save(recognized: RecognizedSegment, context: SegmentContext): Promise<void> {
    return this.settle("save", context, () => {
      this.saved.set(context.position, recognized);
    });
  }

  callsFor(step: SegmentStep): number[] {
    return this.calls.filter((call) => call.step === step).map((call) => call.position);
  }

  private settle<Output>(step: SegmentStep, context: SegmentContext, produce: () => Output): Promise<Output> {
    const { position } = context;

    this.calls.push({ step, position });

    if (this.consume(this.pendingHangs, step, position)) {
      return new Promise<Output>(() => undefined);
    }

    if (this.consume(this.pendingFailures, step, position)) {
      return Promise.reject(new Error(`${step} of segment ${position} failed`));
    }

    return Promise.resolve(produce());
  }

  private consume(pending: StepCall[], step: SegmentStep, position: number): boolean {
    const index = pending.findIndex((entry) => entry.step === step && entry.position === position);

    if (index < 0) {
      return false;
    }

    pending.splice(index, 1);

    return true;
  }
}
