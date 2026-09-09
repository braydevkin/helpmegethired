import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "../database/database";
import { createAccountAdapter, type AccountAdapter } from "./account-adapter";
import { hashSessionToken } from "./session-token";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;
const inTenMinutes = () => new Date(Date.now() + 10 * 60 * 1000);

describe("AccountAdapter", () => {
  let database: Database;
  let adapter: AccountAdapter;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL must point at a migrated database");
    }

    database = createDatabase(connectionString);
    adapter = createAccountAdapter(database);
  });

  afterAll(() => database.destroy());

  describe("users", () => {
    it("creates an Account from an email and reads it back by id and by email", async () => {
      const email = freshEmail();
      const verifiedAt = new Date();

      const created = await adapter.createUser({ id: "ignored", email, emailVerified: verifiedAt });

      expect(created).toEqual({ id: expect.any(String), email, name: null, emailVerified: verifiedAt });
      expect(created.id).not.toBe("ignored");
      expect(await adapter.getUser(created.id)).toEqual(created);
      expect(await adapter.getUserByEmail(email)).toEqual(created);
    });

    it("answers null for an unknown Account and for provider links", async () => {
      expect(await adapter.getUser(crypto.randomUUID())).toBeNull();
      expect(await adapter.getUserByEmail(freshEmail())).toBeNull();
      expect(await adapter.getUserByAccount()).toBeNull();
    });

    it("records when the email was verified", async () => {
      const created = await adapter.createUser({ id: "ignored", email: freshEmail(), emailVerified: null });
      const verifiedAt = new Date();

      const updated = await adapter.updateUser({ id: created.id, emailVerified: verifiedAt });

      expect(updated.emailVerified).toEqual(verifiedAt);
    });
  });

  describe("sessions", () => {
    it("stores only the hash of the token and finds the Session by the token", async () => {
      const user = await adapter.createUser({ id: "ignored", email: freshEmail(), emailVerified: new Date() });
      const sessionToken = crypto.randomUUID();
      const expires = inTenMinutes();

      await adapter.createSession({ sessionToken, userId: user.id, expires });

      const stored = await database
        .selectFrom("sessions")
        .select("token_hash")
        .where("account_id", "=", user.id)
        .executeTakeFirstOrThrow();

      expect(stored.token_hash).toBe(hashSessionToken(sessionToken));
      expect(await adapter.getSessionAndUser(sessionToken)).toEqual({
        session: { sessionToken, userId: user.id, expires },
        user,
      });
    });

    it("updates the expiry and deletes the Session by the token", async () => {
      const user = await adapter.createUser({ id: "ignored", email: freshEmail(), emailVerified: new Date() });
      const sessionToken = crypto.randomUUID();
      const later = new Date(Date.now() + 60 * 60 * 1000);

      await adapter.createSession({ sessionToken, userId: user.id, expires: inTenMinutes() });

      expect(await adapter.updateSession({ sessionToken, expires: later })).toEqual({
        sessionToken,
        userId: user.id,
        expires: later,
      });

      await adapter.deleteSession(sessionToken);

      expect(await adapter.getSessionAndUser(sessionToken)).toBeNull();
    });

    it("answers null for a token that has no Session", async () => {
      expect(await adapter.getSessionAndUser(crypto.randomUUID())).toBeNull();
    });
  });

  describe("verification tokens", () => {
    it("uses a token exactly once", async () => {
      const token = { identifier: freshEmail(), token: hashSessionToken("123456"), expires: inTenMinutes() };

      await adapter.createVerificationToken(token);

      expect(await adapter.useVerificationToken(token)).toEqual(token);
      expect(await adapter.useVerificationToken(token)).toBeNull();
    });

    it("replaces the previous token of the same email", async () => {
      const identifier = freshEmail();
      const first = { identifier, token: hashSessionToken("111111"), expires: inTenMinutes() };
      const second = { identifier, token: hashSessionToken("222222"), expires: inTenMinutes() };

      await adapter.createVerificationToken(first);
      await adapter.createVerificationToken(second);

      expect(await adapter.useVerificationToken(first)).toBeNull();
      expect(await adapter.useVerificationToken(second)).toEqual(second);
    });

    it("answers null for a token of another email", async () => {
      const token = { identifier: freshEmail(), token: hashSessionToken("333333"), expires: inTenMinutes() };

      await adapter.createVerificationToken(token);

      expect(await adapter.useVerificationToken({ identifier: freshEmail(), token: token.token })).toBeNull();
    });
  });
});
