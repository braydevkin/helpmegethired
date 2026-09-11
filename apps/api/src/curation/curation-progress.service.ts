import { Injectable } from "@nestjs/common";
import type { CurationProgressState, Id } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import { curationMetricsOf } from "./curation-metrics";
import { curationProgressOf } from "./curation-progress";
import { CurationProgressRepository } from "./curation-progress.repository";

@Injectable()
export class CurationProgressService {
  constructor(
    private readonly repository: CurationProgressRepository,
    private readonly clock: Clock,
  ) {}

  async progressOf(accountId: Id): Promise<CurationProgressState> {
    const current = await this.repository.currentOf(accountId);

    if (!current) {
      return { progress: null };
    }

    return { progress: curationProgressOf(current.curation, current.units, curationMetricsOf(current.profile, this.clock.now())) };
  }
}
