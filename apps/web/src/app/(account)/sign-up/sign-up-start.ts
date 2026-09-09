import { authClient } from "../../../lib/auth-client";
import { readPendingEmail } from "../../../lib/pending-email-cookie";
import { readSessionToken } from "../../../lib/session-cookie";

export type SignUpStart =
  | { step: "email" }
  | { step: "code"; email: string; sentAt: number }
  | { step: "identity"; email: string };

// A reload lands on the step the Candidate was on: the Session means the code was
// verified and the account information is due; the pending email means a code is
// on its way (design open point 11).
export async function signUpStart(): Promise<SignUpStart> {
  const token = await readSessionToken();
  const account = token ? await authClient.currentAccount(token) : undefined;

  if (account) {
    return { step: "identity", email: account.email };
  }

  const pending = await readPendingEmail();

  return pending ? { step: "code", ...pending } : { step: "email" };
}
