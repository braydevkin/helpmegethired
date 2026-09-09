import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccountSchema, type AccountInformation } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { AccountRepository, DuplicateEmailError } from "./account.repository";
import { AuthModule } from "./auth.module";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;

const information: AccountInformation = {
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+44", number: "7700900123" },
  address: "London, UK",
};

describe("AccountRepository", () => {
  let context: INestApplicationContext;
  let accounts: AccountRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EnvironmentModule, DatabaseModule, AuthModule],
    }).compile();

    context = await moduleRef.init();
    accounts = context.get(AccountRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  it("stores an Account with only its email and reads it back by id", async () => {
    const email = freshEmail();

    const created = await accounts.create({ email });

    expect(AccountSchema.safeParse(created)).toMatchObject({ success: true });
    expect(created).toMatchObject({ email, name: null, lastName: null, phone: null, address: null });
    expect(await accounts.findById(created.id)).toEqual(created);
  });

  it("stores the identity information and reads it back", async () => {
    const created = await accounts.create({ email: freshEmail() });

    const updated = await accounts.updateInformation(created.id, information);

    expect(updated).toEqual({ ...created, ...information });
    expect(await accounts.findById(created.id)).toEqual(updated);
  });

  it("stores an omitted address as null", async () => {
    const created = await accounts.create({ email: freshEmail() });

    const updated = await accounts.updateInformation(created.id, { ...information, address: null });

    expect(updated?.address).toBeNull();
  });

  it("answers undefined for an Account that does not exist", async () => {
    expect(await accounts.findById(crypto.randomUUID())).toBeUndefined();
    expect(await accounts.updateInformation(crypto.randomUUID(), information)).toBeUndefined();
  });

  it("refuses a second Account with the same email", async () => {
    const email = freshEmail();

    await accounts.create({ email });

    await expect(accounts.create({ email })).rejects.toThrow(DuplicateEmailError);
  });
});
