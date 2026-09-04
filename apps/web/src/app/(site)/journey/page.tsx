import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { authClient } from "../../../lib/auth-client";
import { readSessionToken } from "../../../lib/session-cookie";
import { signOutAction } from "../../(account)/actions";
import { SIGN_IN_PATH } from "../../paths";

export const metadata: Metadata = { title: "Your journey | Help Me Get Hired" };

export default async function JourneyPage() {
  const token = await readSessionToken();
  const account = token ? await authClient.currentAccount(token) : undefined;

  if (!account) {
    redirect(SIGN_IN_PATH);
  }

  return (
    <article>
      <h1>Your journey</h1>
      <p className="lead">
        Signed in as <strong data-testid="account-email">{account.email}</strong>.
      </p>
      <p>The next step is uploading your Resume as a PDF. It arrives with the next task.</p>
      <form action={signOutAction} className="site-form">
        <button type="submit">Sign out</button>
      </form>
    </article>
  );
}
