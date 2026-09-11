import { expect, type APIRequestContext } from "@playwright/test";
import { CurationProgressStateSchema, CurationStatementsSchema, type CurationProgress, type CurationStatements } from "@helpmegethired/shared";

import { parsed, POLL_INTERVAL_MS, SETTLE_TIMEOUT_MS } from "./resume-api.js";

// The stack under test runs the development key check and the fake model (ADR-0023), so any key
// but the documented refused one is accepted. A key shaped `sk-ant-fake-<outcome>-on-<unit kind>`
// scripts the fake for that one Candidate's units of that kind; every other call is answered.
export const DUMMY_MODEL_KEY = "sk-ant-e2e-dummy-model-key-0000";

export const fakeKeyPlaying = (outcome: "provider_error" | "rate_limited", unitKind: "synthesis"): string => `sk-ant-fake-${outcome}-on-${unitKind}`;

export async function storeModelKey(api: APIRequestContext, key: string = DUMMY_MODEL_KEY): Promise<void> {
  const saved = await api.put("/account/model", { data: { provider: "anthropic", modelId: "claude-sonnet-5", key } });

  expect(saved.ok()).toBe(true);
}

export async function confirmProfile(api: APIRequestContext): Promise<void> {
  expect((await api.post("/profile/confirm")).ok()).toBe(true);
}

export async function progressOf(api: APIRequestContext): Promise<CurationProgress | null> {
  const response = await api.get("/profile/curation");

  expect(response.status()).toBe(200);

  return (await parsed(response, CurationProgressStateSchema)).progress;
}

// Reads every answer, with no ETag, because the scenarios assert on each state they see on the way.
export async function progressUntil(
  api: APIRequestContext,
  reached: (progress: CurationProgress | null) => boolean,
  onEach: (progress: CurationProgress | null) => void = () => undefined,
): Promise<CurationProgress | null> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let last: CurationProgress | null = null;

  while (Date.now() < deadline) {
    last = await progressOf(api);
    onEach(last);

    if (reached(last)) {
      return last;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`The Curation did not reach the expected state in ${SETTLE_TIMEOUT_MS} ms; last status ${last?.status ?? "none"}`);
}

export const hasStatus =
  (...statuses: CurationProgress["status"][]) =>
  (progress: CurationProgress | null): boolean =>
    progress !== null && statuses.includes(progress.status);

export async function statementsOf(api: APIRequestContext): Promise<CurationStatements> {
  const response = await api.get("/profile/curation/statements");

  expect(response.status()).toBe(200);

  return parsed(response, CurationStatementsSchema);
}
