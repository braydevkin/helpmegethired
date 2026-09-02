import type { Id, SegmentStatus } from "@helpmegethired/shared";

export interface NewSegment {
  kind: string;
  input: unknown;
}

export interface Segment {
  id: Id;
  ingestionId: Id;
  position: number;
  kind: string;
  status: SegmentStatus;
  input: unknown;
  content: unknown;
  recognized: unknown;
  lastError: string | null;
}
