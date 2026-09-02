import { expect, test, type Page } from "@playwright/test";

const password = "correct horse battery";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;

async function submitCredentials(page: Page, path: string, email: string, secret: string) {
  await page.goto(path);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: /sign (up|in)/i }).click();
}

test("a Candidate signs up, signs out, and signs in again", async ({ page }) => {
  const email = freshEmail();

  await submitCredentials(page, "/sign-up", email, password);

  await expect(page).toHaveURL(/\/journey$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your journey");
  await expect(page.getByTestId("account-email")).toHaveText(email);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);

  await submitCredentials(page, "/sign-in", email, password);

  await expect(page).toHaveURL(/\/journey$/);
  await expect(page.getByTestId("account-email")).toHaveText(email);
});

test("the journey redirects to sign in without a Session", async ({ page }) => {
  await page.goto("/journey");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
});

test("validation messages appear before any request is sent", async ({ page }) => {
  await submitCredentials(page, "/sign-up", "ada-at-example.com", "short");

  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Password must have at least 8 characters")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("a wrong password shows the API error", async ({ page }) => {
  const email = freshEmail();

  await submitCredentials(page, "/sign-up", email, password);
  await expect(page).toHaveURL(/\/journey$/);
  await page.getByRole("button", { name: "Sign out" }).click();

  await submitCredentials(page, "/sign-in", email, "not the password");

  await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid email or password");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a duplicate email is refused at sign up", async ({ page }) => {
  const email = freshEmail();

  await submitCredentials(page, "/sign-up", email, password);
  await expect(page).toHaveURL(/\/journey$/);
  await page.getByRole("button", { name: "Sign out" }).click();

  await submitCredentials(page, "/sign-up", email, password);

  await expect(page.locator("form").getByRole("alert")).toHaveText("An Account with this email already exists");
});
