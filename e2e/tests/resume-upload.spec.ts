import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const fixture = join(import.meta.dirname, "../../apps/api/test/fixtures/resumes/corpus/ada-single-column-en.pdf");
const SETTLE_TIMEOUT_MS = 120_000;

test("a Candidate uploads a résumé, watches the percentage reach 100, and reviews and confirms the Profile", async ({ page }) => {
  test.setTimeout(SETTLE_TIMEOUT_MS * 2);

  const { email } = await signUpAndReadSessionToken(page);

  await page.goto("/journey");

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
  await expect(page.getByText("Profile confirmed · the LinkedIn step is next")).toBeVisible();

  await page.goto("/journey");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");
  await expect(page.getByText("Profile confirmed · the LinkedIn step is next")).toBeVisible();
});

test("a PNG is refused in the browser with the designed message", async ({ page }) => {
  await signUpAndReadSessionToken(page);
  await page.goto("/journey/resume");

  await page.locator("input[type=file]").setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: Buffer.from("png") });

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("That file is not a PDF. Export your résumé as PDF and try again.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload your résumé");
});
