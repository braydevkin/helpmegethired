import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const fixture = join(import.meta.dirname, "../../apps/api/test/fixtures/resumes/corpus/ada-single-column-en.pdf");
const SETTLE_TIMEOUT_MS = 120_000;

test("a Candidate uploads a résumé, watches the percentage reach 100, and lands on the Profile page", async ({ page }) => {
  test.setTimeout(SETTLE_TIMEOUT_MS * 2);

  await signUpAndReadSessionToken(page);
  await page.goto("/journey");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your résumé");
  await expect(page.getByText("PDF only · up to 5 MB · one file")).toBeVisible();

  await page.locator("input[type=file]").setInputFiles(fixture);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reading your résumé");
  await expect(page.getByTestId("upload-percentage")).toHaveText("100%", { timeout: SETTLE_TIMEOUT_MS });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your profile is ready");
  await expect(page.getByTestId("profile-data-count")).toHaveText("11 of 11");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your profile is ready");
  await expect(page.getByTestId("upload-percentage")).toHaveText("100%");

  await page.getByRole("link", { name: "Review my profile" }).click();
  await expect(page).toHaveURL(/\/journey\/profile$/);
});

test("a PNG is refused in the browser with the designed message", async ({ page }) => {
  await signUpAndReadSessionToken(page);
  await page.goto("/journey/resume");

  await page.locator("input[type=file]").setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: Buffer.from("png") });

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That file is not a PDF. Export your résumé as PDF and try again.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your résumé");
});
