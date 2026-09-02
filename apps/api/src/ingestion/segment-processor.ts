import type { Id } from "@helpmegethired/shared";

export interface SegmentContext {
  ingestionId: Id;
  accountId: Id;
  segmentId: Id;
  position: number;
}

export abstract class SegmentProcessor<Input = unknown, Content = unknown, Recognized = unknown> {
  abstract readonly kind: string;

  abstract read(input: Input, context: SegmentContext): Promise<Content>;

  abstract recognize(content: Content, context: SegmentContext): Promise<Recognized>;

  abstract save(recognized: Recognized, context: SegmentContext): Promise<void>;
}

export type AnySegmentProcessor = SegmentProcessor<unknown, unknown, unknown>;

export const SEGMENT_PROCESSORS = Symbol("SEGMENT_PROCESSORS");
