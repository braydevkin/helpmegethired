import { Injectable } from "@nestjs/common";
import type { CuratedStatement, CurationStatements, Id, StatementReviewState } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import { StatementReviewRepository } from "./statement-review.repository";

@Injectable()
export class StatementReviewService {
  constructor(
    private readonly repository: StatementReviewRepository,
    private readonly clock: Clock,
  ) {}

  statementsOf(accountId: Id): Promise<CurationStatements> {
    return this.repository.currentOf(accountId);
  }

  review(accountId: Id, statementId: Id, state: StatementReviewState): Promise<CuratedStatement> {
    return this.repository.review(accountId, statementId, state, this.clock.now());
  }
}
