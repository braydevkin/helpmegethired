import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "next-auth/adapters";

import type { AccountRow, Database } from "../database/database";
import { hashSessionToken } from "./session-token";

type AccountUser = Pick<AccountRow, "id" | "email" | "name" | "email_verified_at">;

const accountUserColumns = ["id", "email", "name", "email_verified_at"] as const;

function toAdapterUser(row: AccountUser): AdapterUser {
  return { id: row.id, email: row.email, name: row.name, emailVerified: row.email_verified_at };
}

// Auth.js calls its identity a user and its provider link an account. Here the
// Candidate's identity is the `accounts` table and there are no provider links,
// so the link methods answer as if none existed. Auth.js copies the adapter
// with a spread, so the methods must be own properties of a plain object.
export function createAccountAdapter(database: Database) {
  return {
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      const row = await database
        .insertInto("accounts")
        .values({ email: user.email, email_verified_at: user.emailVerified })
        .returning(accountUserColumns)
        .executeTakeFirstOrThrow();

      return toAdapterUser(row);
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const row = await database
        .selectFrom("accounts")
        .select(accountUserColumns)
        .where("id", "=", id)
        .executeTakeFirst();

      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const row = await database
        .selectFrom("accounts")
        .select(accountUserColumns)
        .where("email", "=", email)
        .executeTakeFirst();

      return row ? toAdapterUser(row) : null;
    },

    getUserByAccount(): Promise<AdapterUser | null> {
      return Promise.resolve(null);
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      const row = await database
        .updateTable("accounts")
        .set({ email_verified_at: user.emailVerified ?? null })
        .where("id", "=", user.id)
        .returning(accountUserColumns)
        .executeTakeFirstOrThrow();

      return toAdapterUser(row);
    },

    async deleteUser(id: string): Promise<void> {
      await database.deleteFrom("accounts").where("id", "=", id).execute();
    },

    linkAccount(): Promise<AdapterAccount | null | undefined> {
      return Promise.resolve(undefined);
    },

    async createSession(session: AdapterSession): Promise<AdapterSession> {
      await database
        .insertInto("sessions")
        .values({
          account_id: session.userId,
          token_hash: hashSessionToken(session.sessionToken),
          expires_at: session.expires,
        })
        .execute();

      return session;
    },

    async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const row = await database
        .selectFrom("sessions")
        .innerJoin("accounts", "accounts.id", "sessions.account_id")
        .select([
          "sessions.expires_at",
          "accounts.id",
          "accounts.email",
          "accounts.name",
          "accounts.email_verified_at",
        ])
        .where("sessions.token_hash", "=", hashSessionToken(sessionToken))
        .executeTakeFirst();

      if (!row) {
        return null;
      }

      return {
        session: { sessionToken, userId: row.id, expires: row.expires_at },
        user: toAdapterUser(row),
      };
    },

    async updateSession(
      session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">,
    ): Promise<AdapterSession | null | undefined> {
      if (!session.expires) {
        return undefined;
      }

      const row = await database
        .updateTable("sessions")
        .set({ expires_at: session.expires })
        .where("token_hash", "=", hashSessionToken(session.sessionToken))
        .returning(["account_id", "expires_at"])
        .executeTakeFirst();

      return row && { sessionToken: session.sessionToken, userId: row.account_id, expires: row.expires_at };
    },

    async deleteSession(sessionToken: string): Promise<void> {
      await database
        .deleteFrom("sessions")
        .where("token_hash", "=", hashSessionToken(sessionToken))
        .execute();
    },

    // A new code replaces the previous one, so only the last code sent is valid.
    async createVerificationToken(token: VerificationToken): Promise<VerificationToken> {
      await database.transaction().execute(async (transaction) => {
        await transaction.deleteFrom("verification_tokens").where("identifier", "=", token.identifier).execute();

        await transaction
          .insertInto("verification_tokens")
          .values({ identifier: token.identifier, token_hash: token.token, expires_at: token.expires })
          .execute();
      });

      return token;
    },

    async useVerificationToken(params: { identifier: string; token: string }): Promise<VerificationToken | null> {
      const row = await database
        .deleteFrom("verification_tokens")
        .where("identifier", "=", params.identifier)
        .where("token_hash", "=", params.token)
        .returning(["identifier", "token_hash", "expires_at"])
        .executeTakeFirst();

      return row ? { identifier: row.identifier, token: row.token_hash, expires: row.expires_at } : null;
    },
  } satisfies Adapter;
}

export type AccountAdapter = ReturnType<typeof createAccountAdapter>;
