import { expect, test, type APIRequest, type Locator, type Page } from "@playwright/test";

import { apiAs, SETTLE_TIMEOUT_MS, uploadCorpusResume } from "./helpers/resume-api.js";
import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const RESUME = "ada-single-column-en";
const MAX_TAB_STOPS = 60;

async function candidateReviewingTheProfile(page: Page, request: APIRequest): Promise<void> {
  const { token } = await signUpAndReadSessionToken(page);

  await uploadCorpusResume(await apiAs(request, token), RESUME);
  await page.goto("/journey/profile");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");
}

const experience = (page: Page) => page.getByRole("region", { name: "Experience" });

const rolesOf = (page: Page) => experience(page).getByRole("heading", { level: 3 });

// Walks the page with Tab alone until the control is reached, the way a keyboard user gets there.
async function tabTo(page: Page, control: Locator): Promise<void> {
  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    await page.keyboard.press("Tab");

    if (await control.evaluate((node) => node.matches(":focus"))) {
      return;
    }
  }

  throw new Error(`Tab never reached the control after ${MAX_TAB_STOPS} stops`);
}

test.describe("the Candidate corrects the recognized Profile", () => {
  test.describe.configure({ timeout: SETTLE_TIMEOUT_MS * 2 });

  test("a corrected headline is what the page shows after saving and after a reload", async ({ page, playwright }) => {
    await candidateReviewingTheProfile(page, playwright.request);

    await page.getByRole("button", { name: "Correct this", exact: true }).click();
    await page.getByLabel("Headline").fill("Distributed systems engineer");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Correct this", exact: true })).toBeVisible();
    await expect(page.getByText(/^Distributed systems engineer · \d+ years of experience$/)).toBeVisible();

    await page.reload();

    await expect(page.getByText(/^Distributed systems engineer · \d+ years of experience$/)).toBeVisible();
    await expect(page.getByRole("region", { name: "About you" }).getByText("Corrected by you")).toBeVisible();
  });

  test("an Experience is corrected, added and removed, and the timeline keeps its order through all three", async ({ page, playwright }) => {
    await candidateReviewingTheProfile(page, playwright.request);

    await expect(rolesOf(page)).toHaveText(["Senior Backend Engineer", "Backend Engineer"]);

    await page.getByRole("button", { name: "Correct this role: Backend Engineer" }).click();
    await page.getByLabel("Role").fill("Platform Engineer");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(rolesOf(page)).toHaveText(["Senior Backend Engineer", "Platform Engineer"]);
    await expect(experience(page).getByText("Corrected by you")).toBeVisible();

    await page.getByRole("button", { name: "Add a role" }).click();
    await page.getByLabel("Role").fill("Volunteer Developer");
    await page.getByLabel("From").fill("2014-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(rolesOf(page)).toHaveText(["Senior Backend Engineer", "Platform Engineer", "Volunteer Developer"]);

    await page.getByRole("button", { name: "Remove Senior Backend Engineer" }).click();
    await expect(rolesOf(page)).toHaveText(["Platform Engineer", "Volunteer Developer"]);

    await page.reload();
    await expect(rolesOf(page)).toHaveText(["Platform Engineer", "Volunteer Developer"]);
  });

  test("one Experience is corrected with the keyboard alone, and the focus comes back to where it started", async ({ page, playwright }) => {
    await candidateReviewingTheProfile(page, playwright.request);

    const correct = page.getByRole("button", { name: "Correct this role: Backend Engineer" });

    await tabTo(page, correct);
    await page.keyboard.press("Enter");

    await expect(page.getByLabel("Role")).toBeFocused();
    await expect(page.getByRole("button", { name: "Confirm profile" })).toBeDisabled();

    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Platform Engineer");
    await page.keyboard.press("Enter");

    await expect(rolesOf(page)).toHaveText(["Senior Backend Engineer", "Platform Engineer"]);
    await expect(page.getByRole("button", { name: "Correct this role: Platform Engineer" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Confirm profile" })).toBeEnabled();
  });
});
