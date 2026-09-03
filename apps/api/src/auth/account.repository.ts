import { Inject, Injectable } from "@nestjs/common";
import type { Account, AccountInformation, Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import { accountColumns, toAccount } from "./account.mapper";

const EMAIL_UNIQUE_CONSTRAINT = "accounts_email_key";

export interface NewAccount {
  email: string;
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`An Account with the email ${email} already exists`);
    this.name = "DuplicateEmailError";
  }
}

@Injectable()
export class AccountRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async create({ email }: NewAccount): Promise<Account> {
    try {
      const row = await this.database
        .insertInto("accounts")
        .values({ email })
        .returning(accountColumns)
        .executeTakeFirstOrThrow();

      return toAccount(row);
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new DuplicateEmailError(email);
      }

      throw error;
    }
  }

  async findById(id: Id): Promise<Account | undefined> {
    const row = await this.database
      .selectFrom("accounts")
      .select(accountColumns)
      .where("id", "=", id)
      .executeTakeFirst();

    return row && toAccount(row);
  }

  async updateInformation(id: Id, information: AccountInformation): Promise<Account | undefined> {
    const row = await this.database
      .updateTable("accounts")
      .set({
        name: information.name,
        last_name: information.lastName,
        phone_country_code: information.phone.countryCode,
        phone_number: information.phone.number,
        address: information.address,
      })
      .where("id", "=", id)
      .returning(accountColumns)
      .executeTakeFirst();

    return row && toAccount(row);
  }
}
