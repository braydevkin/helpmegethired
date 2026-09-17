"use server";

import {
  IdSchema,
  StatementReviewStateSchema,
  type CuratedStatement,
  type CurationActionErrorCode,
  type CurationProgressState,
  type CurationStatements,
  type StatementReviewState,
} from "@helpmegethired/shared";

import { refusalMessageOf } from "../../../../lib/curation-analysis/view";
import { CurationRefusedError, curationClient } from "../../../../lib/curation-client";
import type { CurationReadResult } from "../../../../lib/curation-progress/use-curation-progress";
import { statementClient } from "../../../../lib/statement-client";
import { withSession, type ActionFailure, type ActionResult } from "../../../../lib/with-session";

export interface AnalysisFailure extends ActionFailure {
  code?: CurationActionErrorCode;
}

export type AnalysisActionResult<Value> = ActionResult<Value, AnalysisFailure>;

const NOT_READ_MESSAGE = "We lost track of the analysis. Reload the page to see where it is.";
const NOT_STOPPED_MESSAGE = "We couldn't stop the analysis. Try again in a moment.";
const NOT_RESUMED_MESSAGE = "We couldn't pick the analysis up again. Try again in a moment.";
const NOT_RERUN_MESSAGE = "We couldn't start the analysis again. Try again in a moment.";
const NOT_LISTED_MESSAGE = "We couldn't load the statements. Reload the page to see them.";
const NOT_REVIEWED_MESSAGE = "We couldn't save your review. Try again in a moment.";

// A refusal the gating rules explain keeps its code, so the page can offer the action that does apply.
const refusedWith =
  (fallback: string) =>
  (error: unknown): AnalysisFailure => {
    const code = error instanceof CurationRefusedError ? error.code : undefined;

    return { ok: false, message: refusalMessageOf(code, fallback), ...(code ? { code } : {}) };
  };

export async function readCurationAction(etag: string | undefined): Promise<CurationReadResult> {
  return withSession((token) => curationClient.read(token, etag), refusedWith(NOT_READ_MESSAGE));
}

export async function cancelCurationAction(): Promise<AnalysisActionResult<CurationProgressState>> {
  return withSession((token) => curationClient.cancel(token), refusedWith(NOT_STOPPED_MESSAGE));
}

export async function retryCurationAction(): Promise<AnalysisActionResult<CurationProgressState>> {
  return withSession((token) => curationClient.retry(token), refusedWith(NOT_RESUMED_MESSAGE));
}

export async function rerunCurationAction(): Promise<AnalysisActionResult<CurationProgressState>> {
  return withSession((token) => curationClient.rerun(token), refusedWith(NOT_RERUN_MESSAGE));
}

export async function readStatementsAction(): Promise<AnalysisActionResult<CurationStatements>> {
  return withSession((token) => statementClient.list(token), refusedWith(NOT_LISTED_MESSAGE));
}

export async function reviewStatementAction(id: string, state: StatementReviewState): Promise<AnalysisActionResult<CuratedStatement>> {
  if (!IdSchema.safeParse(id).success || !StatementReviewStateSchema.safeParse(state).success) {
    return { ok: false, message: NOT_REVIEWED_MESSAGE };
  }

  return withSession((token) => statementClient.review(token, id, state), refusedWith(NOT_REVIEWED_MESSAGE));
}
