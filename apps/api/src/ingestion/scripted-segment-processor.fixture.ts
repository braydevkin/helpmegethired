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
  readonly kind = "experience";
  readonly calls: StepCall[] = [];
  readonly saved = new Map<number, RecognizedSegment>();
  private readonly pendingFailures: StepCall[] = [];

  failOnceAt(step: SegmentStep, position: number): this {
    this.pendingFailures.push({ step, position });

    return this;
  }

  read(input: SegmentInput, context: SegmentContext): Promise<SegmentContent> {
    this.record("read", context);

    return Promise.resolve({ words: input.text.split(" ") });
  }

  recognize(content: SegmentContent, context: SegmentContext): Promise<RecognizedSegment> {
    this.record("recognize", context);

    return Promise.resolve({ summary: content.words.join("-") });
  }

  save(recognized: RecognizedSegment, context: SegmentContext): Promise<void> {
    this.record("save", context);
    this.saved.set(context.position, recognized);

    return Promise.resolve();
  }

  callsFor(step: SegmentStep): number[] {
    return this.calls.filter((call) => call.step === step).map((call) => call.position);
  }

  private record(step: SegmentStep, { position }: SegmentContext): void {
    this.calls.push({ step, position });

    const failure = this.pendingFailures.findIndex((entry) => entry.step === step && entry.position === position);

    if (failure >= 0) {
      this.pendingFailures.splice(failure, 1);

      throw new Error(`${step} of segment ${position} failed`);
    }
  }
}
