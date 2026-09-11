import { expect, test, type APIRequest, type APIRequestContext, type Page } from "@playwright/test";
import type { CurationProgress } from "@helpmegethired/shared";

import { confirmProfile, fakeKeyPlaying, hasStatus, progressOf, progressUntil, statementsOf, storeModelKey } from "./helpers/curation-api.js";
import { apiAs, SETTLE_TIMEOUT_MS, uploadCorpusResume } from "./helpers/resume-api.js";
import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const FIRST_RESUME = "ada-single-column-en";
const SECOND_RESUME = "kenji-single-column-en";

const savedUnitIdsOf = (progress: CurationProgress | null): string[] =>
  (progress?.units.list ?? []).filter((unit) => unit.status === "saved").map((unit) => unit.id);

// Each scenario signs up its own Candidate, so a key that scripts the fake reaches only that
// Candidate's Curation, whatever else runs on the stack at the same time.
async function candidateWithConfirmedProfile(page: Page, request: APIRequest): Promise<APIRequestContext> {
  const { token } = await signUpAndReadSessionToken(page);
  const api = await apiAs(request, token);

  await uploadCorpusResume(api, FIRST_RESUME);
  await confirmProfile(api);

  return api;
}

test.describe("a Curation against the fake provider", () => {
  test.describe.configure({ timeout: SETTLE_TIMEOUT_MS * 4 });

  test("a unit that fails past its attempts ends the Curation failed, and a retry resumes without redoing a saved unit", async ({ page, playwright }) => {
    const api = await candidateWithConfirmedProfile(page, playwright.request);

    await storeModelKey(api, fakeKeyPlaying("provider_error", "synthesis"));

    const failed = await progressUntil(api, hasStatus("failed", "completed"));
    const saved = savedUnitIdsOf(failed);

    expect(failed).toMatchObject({ status: "failed", failureReason: "attempts_exhausted" });
    expect(failed?.units.list.filter((unit) => unit.status !== "saved")).toEqual([
      expect.objectContaining({ kind: "synthesis", status: "failed", failureReason: "provider_error" }),
    ]);
    expect(saved).toHaveLength((failed?.units.total ?? 0) - 1);

    const retried = await api.post("/profile/curation/retry");

    expect(retried.status()).toBe(202);

    const failedAgain = await progressUntil(api, hasStatus("failed", "completed"), (progress) => {
      expect(progress?.curationId).toBe(failed?.curationId);
      expect(savedUnitIdsOf(progress)).toEqual(expect.arrayContaining(saved));
    });

    expect(failedAgain).toMatchObject({ status: "failed", failureReason: "attempts_exhausted" });
    expect(savedUnitIdsOf(failedAgain)).toEqual(saved);

    await api.dispose();
  });

  test("a new Resume supersedes a completed Curation, and none of its Statements remain", async ({ page, playwright }) => {
    const api = await candidateWithConfirmedProfile(page, playwright.request);

    await storeModelKey(api);

    const completed = await progressUntil(api, hasStatus("completed", "failed"));

    expect(completed?.status).toBe("completed");

    const previous = await statementsOf(api);

    expect(previous.statements.length).toBeGreaterThan(0);

    await uploadCorpusResume(api, SECOND_RESUME);

    expect(await progressOf(api)).toBeNull();
    expect(await statementsOf(api)).toEqual({ curationId: null, statements: [] });

    await confirmProfile(api);

    const next = await progressUntil(api, hasStatus("completed", "failed"));

    expect(next?.status).toBe("completed");
    expect(next?.curationId).not.toBe(completed?.curationId);

    const previousIds = new Set(previous.statements.map((statement) => statement.id));
    const { statements } = await statementsOf(api);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements.filter((statement) => previousIds.has(statement.id))).toEqual([]);

    await api.dispose();
  });

  test("a new Resume supersedes a Curation that is still in progress", async ({ page, playwright }) => {
    const api = await candidateWithConfirmedProfile(page, playwright.request);

    await storeModelKey(api, fakeKeyPlaying("rate_limited", "synthesis"));

    const paused = await progressUntil(api, (progress) => progress?.status === "queued" && progress.resumeAfter !== null);

    expect(paused?.units.saved).toBe((paused?.units.total ?? 0) - 1);

    await uploadCorpusResume(api, SECOND_RESUME);

    expect(await progressOf(api)).toBeNull();
    expect(await statementsOf(api)).toEqual({ curationId: null, statements: [] });

    await api.dispose();
  });
});
