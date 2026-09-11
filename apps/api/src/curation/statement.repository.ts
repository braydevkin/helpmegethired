import { Inject, Injectable } from "@nestjs/common";
import { StatementSchema, type Id, type Statement } from "@helpmegethired/shared";
import { sql } from "kysely";

import { DATABASE, type Database } from "../database/database";
import type { StatementRow } from "../database/database.schema";
import { toVectorLiteral } from "./vector";

// The columns a Statement answer is read from, which leaves out the embedding a list never shows.
export type StatementFields = Pick<
  StatementRow,
  "id" | "text" | "labels" | "evidence" | "prompt_version" | "model_id" | "review_state" | "reviewed_at" | "created_at"
>;

export const toStatement = (row: StatementFields): Statement =>
  StatementSchema.parse({
    id: row.id,
    text: row.text,
    labels: row.labels,
    evidence: row.evidence,
    promptVersion: row.prompt_version,
    modelId: row.model_id,
    review: { state: row.review_state, reviewedAt: row.reviewed_at?.toISOString() ?? null },
    createdAt: row.created_at.toISOString(),
  });

// What every layer after Profile Curation reads, and all it reads (ADR-0024): the Account's own
// Statements of its current Curation, the latest completed one, never a rejected one, filtered by
// account_id before the similarity ordering (docs/security.md, "AI pipeline").
@Injectable()
export class StatementRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async nearest(accountId: Id, query: readonly number[], limit: number): Promise<Statement[]> {
    const currentCuration = this.database
      .selectFrom("curations")
      .select("id")
      .where("account_id", "=", accountId)
      .where("status", "=", "completed")
      .orderBy("completed_at", "desc")
      .orderBy("id", "desc")
      .limit(1);

    const rows = await this.database
      .selectFrom("statements")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("curation_id", "=", currentCuration)
      .where("review_state", "!=", "rejected")
      .where("embedding", "is not", null)
      .orderBy(sql`embedding <=> ${toVectorLiteral(query)}::vector`)
      .limit(limit)
      .execute();

    return rows.map(toStatement);
  }
}
