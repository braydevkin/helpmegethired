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
import { readSessionToken } from "../../../../lib/session-cookie";
import { statementClient } from "../../../../lib/statement-client";

export type AnalysisActionResult<Value> = { ok: true; value: Value } | { ok: false; message: string; code?: CurationActionErrorCode };

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to continue.";
const NOT_READ_MESSAGE = "We lost track of the analysis. Reload the page to see where it is.";
const NOT_STOPPED_MESSAGE = "We couldn't stop the analysis. Try again in a moment.";
const NOT_RESUMED_MESSAGE = "We couldn't pick the analysis up again. Try again in a moment.";
const NOT_RERUN_MESSAGE = "We couldn't start the analysis again. Try again in a moment.";
const NOT_LISTED_MESSAGE = "We couldn't load the statements. Reload the page to see them.";
const NOT_REVIEWED_MESSAGE = "We couldn't save your review. Try again in a moment.";

// A refusal the gating rules explain keeps its code, so the page can offer the action that does apply.
async function withSession<Value>(work: (token: string) => Promise<Value>, fallback: string): Promise<AnalysisActionResult<Value>> {
  const token = await readSessionToken();

  if (!token) {
    return { ok: false, message: SESSION_EXPIRED_MESSAGE };
  }

  try {
    return { ok: true, value: await work(token) };
  } catch (error) {
    const code = error instanceof CurationRefusedError ? error.code : undefined;

    return { ok: false, message: refusalMessageOf(code, fallback), ...(code ? { code } : {}) };
  }
}

export async function readCurationAction(etag: string | undefined): Promise<CurationReadResult> {
  return withSession((token) => curationClient.read(token, etag), NOT_READ_MESSAGE);
}

export async function cancelCurationAction(): Promise<AnalysisActionResult<CurationProgressState>> {
  return withSession((token) => curationClient.cancel(token), NOT_STOPPED_MESSAGE);
}

export async function retryCurationAction(): Promise<AnalysisActionResult<CurationProgressState>> {
  return withSession((token) => curationClient.retry(token), NOT_RESUMED_MESSAGE);
}

export async function rerunCurationAction(): Promise<AnalysisActionResult<CurationProgressState>> {
  return withSession((token) => curationClient.rerun(token), NOT_RERUN_MESSAGE);
}

export async function readStatementsAction(): Promise<AnalysisActionResult<CurationStatements>> {
  return withSession((token) => statementClient.list(token), NOT_LISTED_MESSAGE);
}

export async function reviewStatementAction(id: string, state: StatementReviewState): Promise<AnalysisActionResult<CuratedStatement>> {
  if (!IdSchema.safeParse(id).success || !StatementReviewStateSchema.safeParse(state).success) {
    return { ok: false, message: NOT_REVIEWED_MESSAGE };
  }

  return withSession((token) => statementClient.review(token, id, state), NOT_REVIEWED_MESSAGE);
}
