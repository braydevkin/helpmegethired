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

export function progressOf(
  ingestionId: string,
  status: IngestionStatus,
  segmentStatuses: readonly SegmentStatus[],
): IngestionProgress {
  const total = segmentStatuses.length;
  const completedSteps = segmentStatuses.reduce((sum, segment) => sum + stepsCompletedBy[segment], 0);
  const percentage = total === 0 ? 100 : Math.floor((100 * completedSteps) / (SEGMENT_STEPS.length * total));

  return {
    ingestionId,
    status,
    percentage,
    segments: { total, saved: segmentStatuses.filter((segment) => segment === "saved").length },
  };
}
