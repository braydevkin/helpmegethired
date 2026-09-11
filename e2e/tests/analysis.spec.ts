import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3001";
const fixture = join(import.meta.dirname, "../../apps/api/test/fixtures/resumes/corpus/ada-single-column-en.pdf");
const SETTLE_TIMEOUT_MS = 120_000;

// The stack under test runs the development key check and the fake model, so any key but the
// documented refused one is accepted and the Curation completes with no Provider account.
const DUMMY_MODEL_KEY = "sk-ant-e2e-dummy-model-key-0000";

test("a Candidate confirms the Profile, chooses the AI, watches the analysis complete, and rejects a Statement from the keyboard", async ({ page, playwright }) => {
  test.setTimeout(SETTLE_TIMEOUT_MS * 3);

  const { token } = await signUpAndReadSessionToken(page);

  await page.goto("/journey");
  await page.locator("input[type=file]").setInputFiles(fixture);
  await expect(page.getByTestId("upload-percentage")).toHaveText("100%", { timeout: SETTLE_TIMEOUT_MS });

  await page.goto("/journey/analysis");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirm your profile to start the analysis");
  await expect(page.getByRole("button", { name: "Paste a job description" })).toHaveAttribute("aria-disabled", "true");

  await page.getByRole("link", { name: "Review and confirm profile" }).click();
  await expect(page).toHaveURL(/\/journey\/profile$/);
  await page.getByRole("button", { name: "Confirm profile" }).click();

  await expect(page).toHaveURL(/\/journey\/analysis$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose your AI to start the analysis");

  const api = await playwright.request.newContext({ baseURL: apiUrl, extraHTTPHeaders: { authorization: `Bearer ${token}` } });
  const saved = await api.put("/account/model", { data: { provider: "anthropic", modelId: "claude-sonnet-5", key: DUMMY_MODEL_KEY } });

  expect(saved.ok()).toBe(true);
  await api.dispose();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We know your profile now", { timeout: SETTLE_TIMEOUT_MS });
  await expect(page.getByTestId("analysis-percentage")).toHaveText("100%");

  const first = page.getByRole("article").first();
  const reject = first.getByRole("button", { name: "Reject" });

  await reject.focus();
  await page.keyboard.press("Enter");

  await expect(first.getByText("Rejected · not used to match you to a job")).toBeVisible();
  await expect(reject).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("article").first().getByRole("button", { name: "Reject" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/journey");
  await expect(page).toHaveURL(/\/journey\/analysis$/);
});
