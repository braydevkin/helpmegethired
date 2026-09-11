import { expect, test } from "@playwright/test";

import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

// The development validator refuses this key as invalid and accepts any other of the right length.
const REFUSED_KEY = "sk-ant-development-refused-key";

test("a Candidate saves their own key from the keyboard, sees it only as stored, and revokes it", async ({ page }) => {
  await signUpAndReadSessionToken(page);
  await page.goto("/journey/ai");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Which AI should read your profile?");
  await expect(page.getByRole("button", { name: "Continue to the analysis" })).toBeDisabled();
  await expect(page.getByText("Add your API key to continue.")).toBeVisible();

  const keyField = page.getByLabel("Anthropic API key");

  await keyField.focus();
  await page.keyboard.type(REFUSED_KEY);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/Anthropic doesn't accept this key/);
  await expect(keyField).toHaveValue("");

  const key = `sk-ant-development-${crypto.randomUUID()}`;

  await keyField.focus();
  await page.keyboard.type(key);
  await page.keyboard.press("Enter");

  await expect(page.getByText("Your Anthropic key is stored")).toBeVisible();
  await expect(page.getByText("Stored · billed by Anthropic")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to the analysis" })).toHaveAttribute("href", "/journey/analysis");
  expect(await page.content()).not.toContain(key);

  await page.reload();
  await expect(page.getByText("Stored · billed by Anthropic")).toBeVisible();
  expect(await page.content()).not.toContain(key);

  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Revoke key" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Not added yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to the analysis" })).toBeDisabled();
});
