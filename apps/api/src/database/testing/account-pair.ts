import { randomUUID } from "node:crypto";

import type { Id } from "@helpmegethired/shared";
import { expect } from "vitest";

import type { Database } from "../database";

export interface AccountPair {
  owner: Id;
  other: Id;
}

export type AccountScopedLookup<T> = (accountId: Id) => Promise<T | undefined>;

const NOT_FOUND_ERROR_NAME = /NotFoundError$/;

async function createAccount(database: Database): Promise<Id> {
  const { id } = await database
    .insertInto("accounts")
    .values({ email: `${randomUUID()}@candidate.example` })
    .returning("id")
    .executeTakeFirstOrThrow();

  return id;
}

export async function createAccountPair(database: Database): Promise<AccountPair> {
  return { owner: await createAccount(database), other: await createAccount(database) };
}

export async function expectScopedToAccount<T>(pair: AccountPair, lookup: AccountScopedLookup<T>): Promise<void> {
  await expect(lookup(pair.owner)).resolves.toBeDefined();

  const outcome = await lookup(pair.other).then(
    (value) => ({ value, error: undefined }),
    (error: unknown) => ({ value: undefined, error }),
  );

  if (outcome.error === undefined) {
    expect(outcome.value).toBeUndefined();

    return;
  }

  expect(outcome.error).toBeInstanceOf(Error);
  expect((outcome.error as Error).name).toMatch(NOT_FOUND_ERROR_NAME);
}
