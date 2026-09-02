import { expect, test } from "@playwright/test";

test("home page states the project goal", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Help Me Get Hired");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Help Me Get Hired");
  await expect(page.getByText(/expands its knowledge of selection processes/)).toBeVisible();
});
