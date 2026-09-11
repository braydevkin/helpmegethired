import { Inject, Injectable } from "@nestjs/common";
import {
  MAX_LIST_ITEMS,
  type CuratedStatement,
  type CurationStatements,
  type CurationUnitKind,
  type Id,
  type StatementReviewState,
} from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { StatementNotFoundError } from "./statement-errors";
import { toStatement, type StatementFields } from "./statement.repository";

type CuratedStatementRow = StatementFields & { unit_kind: CurationUnitKind; unit_title: string };

const toCuratedStatement = ({ unit_kind, unit_title, ...row }: CuratedStatementRow): CuratedStatement => ({
  ...toStatement(row),
  source: { unitKind: unit_kind, title: unit_title },
});

// Every method takes the Account first, so another Account's Statement answers as absent.
@Injectable()
export class StatementReviewRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // The Curation retrieval reads, the latest completed one, so the Candidate reviews exactly the
  // Statements a Job Description would be matched against.
  async currentOf(accountId: Id): Promise<CurationStatements> {
    const current = await this.database
      .selectFrom("curations")
      .select("id")
      .where("account_id", "=", accountId)
      .where("status", "=", "completed")
      .orderBy("completed_at", "desc")
      .orderBy("id", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!current) {
      return { curationId: null, statements: [] };
    }

    const rows = await this.curatedStatements(accountId)
      .where("statements.curation_id", "=", current.id)
      .orderBy("curation_units.position")
      .orderBy("statements.created_at")
      .orderBy("statements.id")
      .limit(MAX_LIST_ITEMS)
      .execute();

    return { curationId: current.id, statements: rows.map(toCuratedStatement) };
  }

  async review(accountId: Id, statementId: Id, state: StatementReviewState, at: Date): Promise<CuratedStatement> {
    const reviewed = await this.database
      .updateTable("statements")
      .set({ review_state: state, reviewed_at: state === "unreviewed" ? null : at, updated_at: at })
      .where("id", "=", statementId)
      .where("account_id", "=", accountId)
      .returning("id")
      .executeTakeFirst();

    if (!reviewed) {
      throw new StatementNotFoundError(statementId);
    }

    return toCuratedStatement(await this.curatedStatements(accountId).where("statements.id", "=", reviewed.id).executeTakeFirstOrThrow());
  }

  private curatedStatements(accountId: Id) {
    return this.database
      .selectFrom("statements")
      .innerJoin("curation_units", "curation_units.id", "statements.unit_id")
      .select([
        "statements.id",
        "statements.text",
        "statements.labels",
        "statements.evidence",
        "statements.prompt_version",
        "statements.model_id",
        "statements.review_state",
        "statements.reviewed_at",
        "statements.created_at",
        "curation_units.kind as unit_kind",
        "curation_units.title as unit_title",
      ])
      .where("statements.account_id", "=", accountId);
  }
}
