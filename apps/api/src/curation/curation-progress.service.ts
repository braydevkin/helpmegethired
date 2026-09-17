import { Injectable } from "@nestjs/common";
import type { CurationProgressState, Id } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import { curationMetricsOf } from "./curation-metrics";
import { curationProgressOf, rerunOf } from "./curation-progress";
import { CurationProgressRepository } from "./curation-progress.repository";
import { RerunGate } from "./rerun-gate";

@Injectable()
export class CurationProgressService {
  constructor(
    private readonly repository: CurationProgressRepository,
    private readonly rerunGate: RerunGate,
    private readonly clock: Clock,
  ) {}

  async progressOf(accountId: Id): Promise<CurationProgressState> {
    const current = await this.repository.currentOf(accountId);

    if (!current) {
      return { progress: null };
    }

    const rerun = rerunOf(await this.rerunGate.refusalFor(accountId));

    return { progress: curationProgressOf(current.curation, current.units, curationMetricsOf(current.profile, this.clock.now()), rerun) };
  }
}
