import { createHash } from "node:crypto";

// The API validates bearer tokens against the same `sessions.token_hash`
// column, so both apps must hash a token identically.
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
