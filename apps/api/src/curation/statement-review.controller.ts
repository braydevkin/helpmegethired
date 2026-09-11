import { Body, Controller, Get, Param, Put, UseFilters } from "@nestjs/common";
import {
  IdSchema,
  StatementReviewRequestSchema,
  type Account,
  type CuratedStatement,
  type CurationStatements,
  type Id,
  type StatementReviewRequest,
} from "@helpmegethired/shared";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { StatementErrorFilter } from "./statement-error.filter";
import { StatementReviewService } from "./statement-review.service";

@Controller("profile/curation/statements")
@UseFilters(StatementErrorFilter)
export class StatementReviewController {
  constructor(private readonly statements: StatementReviewService) {}

  @Get()
  list(@CurrentAccount() account: Account): Promise<CurationStatements> {
    return this.statements.statementsOf(account.id);
  }

  @Put(":id/review")
  review(
    @CurrentAccount() account: Account,
    @Param("id", new ZodValidationPipe(IdSchema)) id: Id,
    @Body(new ZodValidationPipe(StatementReviewRequestSchema)) request: StatementReviewRequest,
  ): Promise<CuratedStatement> {
    return this.statements.review(account.id, id, request.state);
  }
}
