import { Inject, Injectable } from "@nestjs/common";
import type { Account, Id } from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import { isUniqueViolation } from "../database/database-errors";
import { toAccount } from "./account.mapper";

const EMAIL_UNIQUE_CONSTRAINT = "accounts_email_key";

const publicColumns = ["id", "email", "created_at"] as const;

export interface NewAccount {
  email: string;
  passwordHash: string;
}

export interface StoredCredentials {
  account: Account;
  passwordHash: string;
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

  async create({ email, passwordHash }: NewAccount): Promise<Account> {
    try {
      const row = await this.database
        .insertInto("accounts")
        .values({ email, password_hash: passwordHash })
        .returning(publicColumns)
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
      .select(publicColumns)
      .where("id", "=", id)
      .executeTakeFirst();

    return row && toAccount(row);
  }

  async findByEmail(email: string): Promise<Account | undefined> {
    const row = await this.database
      .selectFrom("accounts")
      .select(publicColumns)
      .where("email", "=", email)
      .executeTakeFirst();

    return row && toAccount(row);
  }

  async findCredentialsByEmail(email: string): Promise<StoredCredentials | undefined> {
    const row = await this.database
      .selectFrom("accounts")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    return row && { account: toAccount(row), passwordHash: row.password_hash };
  }
}
