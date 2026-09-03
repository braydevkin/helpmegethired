import { expect, test, type Page } from "@playwright/test";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;

async function requestCode(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inbox");
}

async function lastCodeFor(page: Page, email: string): Promise<string> {
  const response = await page.request.get(`/development/verification-code?email=${encodeURIComponent(email)}`);

  expect(response.ok()).toBe(true);

  const { code } = (await response.json()) as { code: string };

  return code;
}

async function submitCode(page: Page, code: string) {
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
}

async function signInWithCode(page: Page, path: string, email: string): Promise<string> {
  await requestCode(page, path, email);

  const code = await lastCodeFor(page, email);

  await submitCode(page, code);

  return code;
}

test("a Candidate signs up with a code, signs out, and signs in again", async ({ page }) => {
  const email = freshEmail();

  await signInWithCode(page, "/sign-up", email);

  await expect(page).toHaveURL(/\/journey$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your journey");
  await expect(page.getByTestId("account-email")).toHaveText(email);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);

  await signInWithCode(page, "/sign-in", email);

  await expect(page).toHaveURL(/\/journey$/);
  await expect(page.getByTestId("account-email")).toHaveText(email);
});

test("sign in with an email that has no Account goes through the same screens", async ({ page }) => {
  const email = freshEmail();

  await signInWithCode(page, "/sign-in", email);

  await expect(page).toHaveURL(/\/journey$/);
  await expect(page.getByTestId("account-email")).toHaveText(email);
});

test("the journey redirects to sign in without a Session", async ({ page }) => {
  await page.goto("/journey");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to keep going");
});

test("validation messages appear before any request is sent", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email address").fill("ada-at-example.com");
  await page.getByRole("button", { name: "Send my code" }).click();

  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("a wrong code is refused inline and the right one still works", async ({ page }) => {
  const email = freshEmail();

  await requestCode(page, "/sign-in", email);

  const code = await lastCodeFor(page, email);
  const wrongCode = code === "000000" ? "000001" : "000000";

  await submitCode(page, wrongCode);

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That code is not valid or has expired. Request a new one.",
  );
  await expect(page).toHaveURL(/\/sign-in$/);

  await submitCode(page, code);

  await expect(page).toHaveURL(/\/journey$/);
});

test("a code works only once", async ({ page }) => {
  const email = freshEmail();
  const code = await signInWithCode(page, "/sign-in", email);

  await expect(page).toHaveURL(/\/journey$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inbox");
  await submitCode(page, code);

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That code is not valid or has expired. Request a new one.",
  );
});

test("a new code replaces the previous one", async ({ page }) => {
  const email = freshEmail();

  await requestCode(page, "/sign-in", email);

  const firstCode = await lastCodeFor(page, email);

  await page.getByRole("button", { name: "Change email" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inbox");

  const secondCode = await lastCodeFor(page, email);

  test.skip(firstCode === secondCode, "the two random codes collided");

  await submitCode(page, firstCode);

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That code is not valid or has expired. Request a new one.",
  );

  await submitCode(page, secondCode);

  await expect(page).toHaveURL(/\/journey$/);
});
