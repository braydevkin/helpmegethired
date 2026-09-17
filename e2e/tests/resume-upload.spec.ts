import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { DUMMY_MODEL_KEY, storeModelKey } from "./helpers/curation-api.js";
import { apiAs } from "./helpers/resume-api.js";
import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const fixture = join(import.meta.dirname, "../../apps/api/test/fixtures/resumes/corpus/ada-single-column-en.pdf");
const SETTLE_TIMEOUT_MS = 120_000;

test("a new Account opens on Choose your AI, and the upload step leads there until a key is stored", async ({ page }) => {
  await signUpAndReadSessionToken(page);

  await page.goto("/journey");
  await expect(page).toHaveURL(/\/journey\/ai$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Which AI should read your profile?");
  await expect(page.getByText(/When you upload your résumé, its text is read by the model you choose here/)).toBeVisible();

  await page.goto("/journey/resume");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choose your AI before you upload");
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Upload your résumé" })).toHaveAttribute("aria-disabled", "true");

  await page.getByRole("link", { name: "Choose your AI" }).click();
  await expect(page).toHaveURL(/\/journey\/ai$/);
});

test("a Candidate stores a key, uploads a résumé, watches the percentage reach 100, and reviews and confirms the Profile", async ({ page }) => {
  test.setTimeout(SETTLE_TIMEOUT_MS * 3);

  const { email } = await signUpAndReadSessionToken(page);

  await page.goto("/journey");
  await expect(page).toHaveURL(/\/journey\/ai$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Anthropic API key").fill(DUMMY_MODEL_KEY);
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("Your Anthropic key is stored")).toBeVisible();

  await page.getByRole("link", { name: "Continue to your résumé" }).click();
  await expect(page).toHaveURL(/\/journey\/resume$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your résumé");
  await expect(page.getByText("PDF only · up to 5 MB · one file")).toBeVisible();

  await page.locator("input[type=file]").setInputFiles(fixture);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reading your résumé");
  await expect(page.getByTestId("upload-percentage")).toHaveText("100%", { timeout: SETTLE_TIMEOUT_MS });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your profile is ready");
  await expect(page.getByTestId("profile-data-count")).toHaveText("11 of 11");

  // `/journey` has moved on to the Profile review by now, so the done state is read at the
  // upload step's own route.
  await page.goto("/journey/resume");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your profile is ready");
  await expect(page.getByTestId("upload-percentage")).toHaveText("100%");

  await page.getByRole("link", { name: "Review my profile" }).click();
  await expect(page).toHaveURL(/\/journey\/profile$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");
  await expect(page.getByRole("region", { name: "Contact" }).getByText(email)).toBeVisible();
  await expect(page.getByRole("region", { name: "Experience" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Skills" })).toBeVisible();

  await page.getByRole("button", { name: "Confirm profile" }).click();
  await expect(page).toHaveURL(/\/journey\/analysis$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We know your profile now", { timeout: SETTLE_TIMEOUT_MS });

  await page.goto("/journey");
  await expect(page).toHaveURL(/\/journey\/analysis$/);

  await page.goto("/journey/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");
  await expect(page.getByText("Profile confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the analysis" })).toHaveAttribute("href", "/journey/analysis");
});

test("a PNG is refused in the browser with the designed message", async ({ page, playwright }) => {
  const { token } = await signUpAndReadSessionToken(page);
  const api = await apiAs(playwright.request, token);

  await storeModelKey(api);
  await api.dispose();
  await page.goto("/journey/resume");

  await page.locator("input[type=file]").setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: Buffer.from("png") });

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That file is not a PDF. Export your résumé as PDF and try again.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your résumé");
});
