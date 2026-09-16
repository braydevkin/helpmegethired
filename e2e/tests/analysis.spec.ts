import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { revokeModelKey, storeModelKey } from "./helpers/curation-api.js";
import { apiAs } from "./helpers/resume-api.js";
import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const fixture = join(import.meta.dirname, "../../apps/api/test/fixtures/resumes/corpus/ada-single-column-en.pdf");
const SETTLE_TIMEOUT_MS = 120_000;

test("a Candidate whose key was revoked confirms the Profile, stores a key again, watches the analysis complete, and rejects a Statement from the keyboard", async ({
  page,
  playwright,
}) => {
  test.setTimeout(SETTLE_TIMEOUT_MS * 3);

  const { token } = await signUpAndReadSessionToken(page);
  const api = await apiAs(playwright.request, token);

  await storeModelKey(api);

  await page.goto("/journey");
  await page.locator("input[type=file]").setInputFiles(fixture);
  await expect(page.getByTestId("upload-percentage")).toHaveText("100%", { timeout: SETTLE_TIMEOUT_MS });

  await revokeModelKey(api);

  await page.goto("/journey");
  await expect(page).toHaveURL(/\/journey\/ai$/);
  await expect(page.getByRole("button", { name: "Continue to your profile" })).toBeDisabled();

  await page.goto("/journey/analysis");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirm your profile to start the analysis");
  await expect(page.getByRole("button", { name: "Paste a job description" })).toHaveAttribute("aria-disabled", "true");

  await page.getByRole("link", { name: "Review and confirm profile" }).click();
  await expect(page).toHaveURL(/\/journey\/profile$/);
  await page.getByRole("button", { name: "Confirm profile" }).click();

  await expect(page).toHaveURL(/\/journey\/analysis$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose your AI to start the analysis");

  await storeModelKey(api);
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
