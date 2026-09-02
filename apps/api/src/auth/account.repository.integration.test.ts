import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccountSchema } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { AccountRepository, DuplicateEmailError } from "./account.repository";
import { AuthModule } from "./auth.module";

const passwordHash = "scrypt$32768$8$1$c2FsdA==$a2V5";

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

  it("stores an Account and reads it back by id and by email without the password hash", async () => {
    const email = `${crypto.randomUUID()}@candidate.example`;

    const created = await accounts.create({ email, passwordHash });

    expect(AccountSchema.safeParse(created)).toMatchObject({ success: true });
    expect(created).not.toHaveProperty("passwordHash");
    expect(await accounts.findById(created.id)).toEqual(created);
    expect(await accounts.findByEmail(email)).toEqual(created);
  });

  it("reads the stored credentials by email", async () => {
    const email = `${crypto.randomUUID()}@candidate.example`;

    const created = await accounts.create({ email, passwordHash });

    expect(await accounts.findCredentialsByEmail(email)).toEqual({ account: created, passwordHash });
  });

  it("answers undefined for an Account that does not exist", async () => {
    expect(await accounts.findById(crypto.randomUUID())).toBeUndefined();
    expect(await accounts.findCredentialsByEmail("nobody@candidate.example")).toBeUndefined();
  });

  it("refuses a second Account with the same email", async () => {
    const email = `${crypto.randomUUID()}@candidate.example`;

    await accounts.create({ email, passwordHash });

    await expect(accounts.create({ email, passwordHash })).rejects.toThrow(DuplicateEmailError);
  });
});
