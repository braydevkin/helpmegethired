import type { CurationStatus, Id } from "@helpmegethired/shared";

export interface CurationOrigin {
  sourceIngestionId: Id;
  modelId: string;
  promptVersion: string;
}

const RESTARTABLE_STATUSES: readonly CurationStatus[] = ["failed", "cancelled"];

// A re-run spends the Candidate's tokens from zero, so it is allowed only when the result could
// differ from the one they have: the newest Curation of the Profile did not complete, there is no
// completed one, or the completed one came from another Profile, Model, or prompt version.
export function isRerunAllowed(latest: { status: CurationStatus } | undefined, current: CurationOrigin | undefined, wanted: CurationOrigin): boolean {
  if (!latest || RESTARTABLE_STATUSES.includes(latest.status) || !current) {
    return true;
  }

  return current.sourceIngestionId !== wanted.sourceIngestionId || current.modelId !== wanted.modelId || current.promptVersion !== wanted.promptVersion;
}
