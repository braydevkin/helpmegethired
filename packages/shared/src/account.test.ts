import { describe, expect, it } from "vitest";

import { AccountSchema } from "./account.js";
import { account } from "./candidate.fixtures.js";

describe("AccountSchema", () => {
  it("accepts an account with a uuid, an email, and a creation timestamp", () => {
    expect(AccountSchema.safeParse(account).success).toBe(true);
  });

  it.each([
    ["a malformed email", { ...account, email: "ada-at-example.com" }],
    ["a non-uuid id", { ...account, id: "account-1" }],
    ["a date without time", { ...account, createdAt: "2026-09-02" }],
  ])("rejects %s", (_label, input) => {
    expect(AccountSchema.safeParse(input).success).toBe(false);
  });
});
