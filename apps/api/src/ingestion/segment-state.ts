import type { IngestionProgress, IngestionStatus, SegmentStatus, SegmentStep } from "@helpmegethired/shared";

export const SEGMENT_STEPS: readonly SegmentStep[] = ["read", "recognize", "save"];

const stepsCompletedBy: Record<SegmentStatus, number> = { pending: 0, read: 1, recognized: 2, saved: 3 };

export function stepsRemainingFor(status: SegmentStatus): readonly SegmentStep[] {
  return SEGMENT_STEPS.slice(stepsCompletedBy[status]);
}

const statusReachedBy: Record<SegmentStep, SegmentStatus> = { read: "read", recognize: "recognized", save: "saved" };

export function statusAfter(step: SegmentStep): SegmentStatus {
  return statusReachedBy[step];
}

export interface SegmentProgress {
  kind: string;
  status: SegmentStatus;
}

export function progressOf(ingestionId: string, status: IngestionStatus, segments: readonly SegmentProgress[]): IngestionProgress {
  const total = segments.length;
  const completedSteps = segments.reduce((sum, segment) => sum + stepsCompletedBy[segment.status], 0);
  const percentage = total === 0 ? 100 : Math.floor((100 * completedSteps) / (SEGMENT_STEPS.length * total));
  const saved = segments.filter((segment) => segment.status === "saved");

  return {
    ingestionId,
    status,
    percentage,
    segments: { total, saved: saved.length, savedKinds: saved.map((segment) => segment.kind) },
  };
}
