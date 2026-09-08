import type { Id } from "@helpmegethired/shared";

export class ProfileNotFoundError extends Error {
  constructor(accountId: Id) {
    super(`The Account ${accountId} has no Profile built yet`);
    this.name = "ProfileNotFoundError";
  }
}
