import { createHash } from "node:crypto";

import type { CurationFailureReason, CurationMetrics, CurationProgress, CurationProgressState, CurationStatus, CurationUnitSummary, Id } from "@helpmegethired/shared";

export interface ProgressedCuration {
  id: Id;
  status: CurationStatus;
  modelId: string;
  failureReason: CurationFailureReason | null;
  resumeAfter: Date | null;
}

// Only saved units count, so the number is read from the rows alone and a fresh process, a
// reload, or a second tab answers the same one.
export function percentageOf(units: readonly Pick<CurationUnitSummary, "status">[]): number {
  if (units.length === 0) {
    return 0;
  }

  return Math.floor((100 * units.filter((unit) => unit.status === "saved").length) / units.length);
}

export function curationProgressOf(curation: ProgressedCuration, units: readonly CurationUnitSummary[], metrics: CurationMetrics): CurationProgress {
  return {
    curationId: curation.id,
    status: curation.status,
    percentage: percentageOf(units),
    units: {
      total: units.length,
      saved: units.filter((unit) => unit.status === "saved").length,
      list: [...units],
    },
    metrics,
    modelId: curation.modelId,
    failureReason: curation.failureReason,
    resumeAfter: curation.resumeAfter?.toISOString() ?? null,
  };
}

// The whole answer goes into the tag, so any change the page could render yields a new one.
export function etagOf(state: CurationProgressState): string {
  return `"${createHash("sha1").update(JSON.stringify(state)).digest("hex")}"`;
}
