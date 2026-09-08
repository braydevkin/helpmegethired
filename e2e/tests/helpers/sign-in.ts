import { expect, type Page } from "@playwright/test";

export const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;

export async function requestCode(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inbox");
}

// The web app's development route answers the last code sent to an address; it is absent in production.
export async function lastCodeFor(page: Page, email: string): Promise<string> {
  const response = await page.request.get(`/development/verification-code?email=${encodeURIComponent(email)}`);

  expect(response.ok()).toBe(true);

  const { code } = (await response.json()) as { code: string };

  return code;
}

export async function submitCode(page: Page, code: string) {
  await page.getByLabel("Verification digit").first().pressSequentially(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
}

export async function verifyEmail(page: Page, path: string, email: string): Promise<string> {
  await requestCode(page, path, email);

  const code = await lastCodeFor(page, email);

  await submitCode(page, code);

  return code;
}

export async function completeIdentity(page: Page, name = "Ada") {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Phone").fill("912 345 678");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`You're in, ${name}`);
  await page.getByRole("link", { name: "Go to my dashboard" }).click();
  await expect(page).toHaveURL(/\/journey$/);
}

// Signs a new Candidate up through the web app and answers the Session token it keeps in
// its cookie, which is the bearer token the API accepts. No route exchanges a code for a token.
export async function signUpAndReadSessionToken(page: Page): Promise<{ email: string; token: string }> {
  const email = freshEmail();

  await verifyEmail(page, "/sign-up", email);
  await completeIdentity(page);

  const session = (await page.context().cookies()).find((cookie) => cookie.name === "session");

  if (!session) {
    throw new Error("The web app set no session cookie after sign up");
  }

  return { email, token: session.value };
}
