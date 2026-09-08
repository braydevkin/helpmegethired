import type { Account } from "@helpmegethired/shared";
import { redirect } from "next/navigation";

import { authClient } from "../../../lib/auth-client";
import { initialsOf } from "../../../lib/resume-upload/format";
import { readSessionToken } from "../../../lib/session-cookie";
import { SIGN_IN_PATH } from "../../paths";

export interface Candidate {
  token: string;
  account: Account;
  initials: string;
  name: string;
}

// The signed-in Candidate every journey page renders for; anyone else goes to sign in.
export async function requireCandidate(): Promise<Candidate> {
  const token = await readSessionToken();
  const account = token ? await authClient.currentAccount(token) : undefined;

  if (!token || !account) {
    redirect(SIGN_IN_PATH);
  }

  return {
    token,
    account,
    initials: initialsOf(account.name, account.lastName),
    name: [account.name, account.lastName].filter(Boolean).join(" ") || account.email,
  };
}
