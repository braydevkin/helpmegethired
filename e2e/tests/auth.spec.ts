import { expect, test, type Page } from "@playwright/test";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;
const CODE_REJECTED = "That code is not valid or has expired. Request a new one.";

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
  await page.getByLabel("Verification digit").first().pressSequentially(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
}

async function verifyEmail(page: Page, path: string, email: string): Promise<string> {
  await requestCode(page, path, email);

  const code = await lastCodeFor(page, email);

  await submitCode(page, code);

  return code;
}

async function expectIdentityStep(page: Page, email: string) {
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tell us who you are");
  await expect(page.getByLabel("Email")).toHaveValue(email);
}

async function completeIdentity(page: Page, name = "Ada") {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Phone").fill("912 345 678");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`You're in, ${name}`);
  await page.getByRole("link", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/journey$/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

test("a Candidate signs up in three steps, signs out, and signs in again", async ({ page }) => {
  const email = freshEmail();

  await page.goto("/sign-up");
  await expect(page.getByRole("progressbar", { name: "Step 1 of 3" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's get you hired");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");

  await verifyEmail(page, "/sign-up", email);
  await expectIdentityStep(page, email);
  await expect(page.getByRole("progressbar", { name: "Step 3 of 3" })).toBeVisible();
  await expect(page.getByText("Verified")).toBeVisible();
  await expect(page.getByLabel("Country code")).toHaveValue("+351");

  await completeIdentity(page);
  await expect(page.getByTestId("account-email")).toHaveText(email);

  await signOut(page);

  await verifyEmail(page, "/sign-in", email);

  await expect(page).toHaveURL(/\/journey$/);
  await expect(page.getByTestId("account-email")).toHaveText(email);
});

test("sign in with an email that has no Account is sent to the account information step", async ({ page }) => {
  const email = freshEmail();

  await verifyEmail(page, "/sign-in", email);
  await expectIdentityStep(page, email);

  await page.goto("/journey");
  await expectIdentityStep(page, email);

  await page.goto("/sign-in");
  await expectIdentityStep(page, email);
});

test("reloading during step 2 and step 3 keeps the email", async ({ page }) => {
  const email = freshEmail();

  await requestCode(page, "/sign-up", email);
  await page.reload();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inbox");
  await expect(page.getByText(email)).toBeVisible();

  await submitCode(page, await lastCodeFor(page, email));
  await expectIdentityStep(page, email);

  await page.reload();
  await expectIdentityStep(page, email);
});

test("the identity step validates with the shared schema before saving", async ({ page }) => {
  const email = freshEmail();

  await verifyEmail(page, "/sign-up", email);
  await expectIdentityStep(page, email);

  await page.getByLabel("Phone").fill("12");
  await page.getByRole("button", { name: "Create my account" }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText([
    "Name is required",
    "Last name is required",
    "Enter a phone number we can reach you on",
  ]);
  await expect(page).toHaveURL(/\/sign-up$/);

  await completeIdentity(page, "Grace");
});

test("the sign in screens follow the Account design", async ({ page }) => {
  const email = freshEmail();

  await page.goto("/sign-in");

  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
  await expect(page.getByRole("progressbar")).toHaveCount(0);

  await requestCode(page, "/sign-in", email);

  await expect(page.getByText(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`)).toBeVisible();
  await expect(page.getByLabel("Verification digit")).toHaveCount(6);
  await expect(page.getByText(/Resend in 0:\d\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend code" })).toHaveCount(0);
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

  await expect(page.locator("form").getByRole("alert")).toHaveText(CODE_REJECTED);
  await expect(page).toHaveURL(/\/sign-in$/);

  await submitCode(page, code);
  await expectIdentityStep(page, email);
});

test("a code works only once", async ({ page }) => {
  const email = freshEmail();
  const code = await verifyEmail(page, "/sign-up", email);

  await expectIdentityStep(page, email);
  await completeIdentity(page);
  await signOut(page);

  await requestCode(page, "/sign-in", email);
  await submitCode(page, code);

  await expect(page.locator("form").getByRole("alert")).toHaveText(CODE_REJECTED);
});

test("a new code replaces the previous one", async ({ page }) => {
  const email = freshEmail();

  await requestCode(page, "/sign-in", email);

  const firstCode = await lastCodeFor(page, email);

  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue(email);
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inbox");

  const secondCode = await lastCodeFor(page, email);

  test.skip(firstCode === secondCode, "the two random codes collided");

  await submitCode(page, firstCode);

  await expect(page.locator("form").getByRole("alert")).toHaveText(CODE_REJECTED);

  await submitCode(page, secondCode);
  await expectIdentityStep(page, email);
});
