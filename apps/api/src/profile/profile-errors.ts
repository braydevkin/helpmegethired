import type { Id, ProfileListPart } from "@helpmegethired/shared";

export class ProfileNotFoundError extends Error {
  constructor(accountId: Id) {
    super(`The Account ${accountId} has no Profile built yet`);
    this.name = "ProfileNotFoundError";
  }
}

// Confirming starts the Curation that reads the Profile, so a correction afterwards would
// describe a Candidate the analysis has already been run for.
export class ProfileConfirmedError extends Error {
  constructor(accountId: Id) {
    super(`The Profile of the Account ${accountId} is confirmed and takes no more corrections`);
    this.name = "ProfileConfirmedError";
  }
}

export class ProfileEntryNotFoundError extends Error {
  constructor(part: ProfileListPart, entryId: Id) {
    super(`No ${part} entry ${entryId} belongs to this Profile`);
    this.name = "ProfileEntryNotFoundError";
  }
}
