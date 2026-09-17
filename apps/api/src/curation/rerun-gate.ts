import { Injectable } from "@nestjs/common";
import type { CurationRerunRefusal, CurationStatus, Id } from "@helpmegethired/shared";

import type { Database } from "../database/database";
import { CURATION_PROMPT_VERSION } from "./curation-starter";
import { CurationRepository, type CurationReadiness } from "./curation.repository";

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

export interface RerunFacts {
  active: boolean;
  readiness: CurationReadiness | undefined;
  latest: { status: CurationStatus } | undefined;
  current: CurationOrigin | undefined;
}

// What `POST /profile/curation/rerun` answers, in the order it checks: a Curation in flight, a
// Profile or key not ready, then the gate above. The progress answer carries the same code.
export function rerunRefusalOf({ active, readiness, latest, current }: RerunFacts, promptVersion: string): CurationRerunRefusal | null {
  if (active) {
    return "curation_active";
  }

  if (!readiness) {
    return "curation_not_ready";
  }

  const wanted = { sourceIngestionId: readiness.ingestionId, modelId: readiness.modelId, promptVersion };

  return isRerunAllowed(latest, current, wanted) ? null : "curation_unchanged";
}

@Injectable()
export class RerunGate {
  constructor(private readonly curations: CurationRepository) {}

  async refusalFor(accountId: Id, database?: Database): Promise<CurationRerunRefusal | null> {
    const active = await this.curations.findActive(accountId, database);
    const readiness = await this.curations.readinessOf(accountId, database);
    const latest = readiness && (await this.curations.findLatestOf(accountId, readiness.ingestionId, database));
    const current = await this.curations.findCurrentCompleted(accountId, database);

    return rerunRefusalOf({ active: active !== undefined, readiness, latest, current }, CURATION_PROMPT_VERSION);
  }
}
