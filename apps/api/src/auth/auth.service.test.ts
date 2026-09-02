import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuthenticatedAccountSchema, type Account } from "@helpmegethired/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { AccountRepository, DuplicateEmailError, type NewAccount } from "./account.repository";
import { AuthService } from "./auth.service";
import { PasswordHasher } from "./password-hasher";
import { SessionRepository, type NewSession } from "./session.repository";
import { hashSessionToken } from "./session-token";

class TransparentPasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${password}`);
  }
}

class InMemoryAccounts {
  readonly rows: Array<{ account: Account; passwordHash: string }> = [];

  create({ email, passwordHash }: NewAccount): Promise<Account> {
    if (this.rows.some((row) => row.account.email === email)) {
      return Promise.reject(new DuplicateEmailError(email));
    }

    const account = { id: crypto.randomUUID(), email, createdAt: new Date().toISOString() };

    this.rows.push({ account, passwordHash });

    return Promise.resolve(account);
  }

  findCredentialsByEmail(email: string) {
    return Promise.resolve(this.rows.find((row) => row.account.email === email));
  }
}

class InMemorySessions {
  readonly rows: NewSession[] = [];

  constructor(private readonly accounts: InMemoryAccounts) {}

  create(session: NewSession): Promise<void> {
    this.rows.push(session);

    return Promise.resolve();
  }

  findAccountByTokenHash(tokenHash: string, now: Date): Promise<Account | undefined> {
    const session = this.rows.find((row) => row.tokenHash === tokenHash && row.expiresAt > now);
    const account = this.accounts.rows.find((row) => row.account.id === session?.accountId)?.account;

    return Promise.resolve(account);
  }

  deleteByTokenHash(tokenHash: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.tokenHash === tokenHash);

    if (index >= 0) {
      this.rows.splice(index, 1);
    }

    return Promise.resolve();
  }
}

const credentials = { email: "ada@example.com", password: "correct horse battery" };

describe("AuthService", () => {
  let accounts: InMemoryAccounts;
  let sessions: InMemorySessions;
  let service: AuthService;

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    sessions = new InMemorySessions(accounts);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountRepository, useValue: accounts },
        { provide: SessionRepository, useValue: sessions },
        { provide: PasswordHasher, useClass: TransparentPasswordHasher },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("signUp", () => {
    it("creates the Account with a hashed password and opens a Session", async () => {
      const result = await service.signUp(credentials);

      expect(AuthenticatedAccountSchema.safeParse(result)).toMatchObject({ success: true });
      expect(result.account.email).toBe(credentials.email);
      expect(accounts.rows[0]?.passwordHash).toBe("hashed:correct horse battery");
      expect(sessions.rows[0]).toMatchObject({
        accountId: result.account.id,
        tokenHash: hashSessionToken(result.session.token),
      });
    });

    it("issues a Session that expires in the future", async () => {
      const { session } = await service.signUp(credentials);

      expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("rejects a second sign up with the same email as a conflict", async () => {
      await service.signUp(credentials);

      await expect(service.signUp({ ...credentials, password: "another password" })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("signIn", () => {
    beforeEach(() => service.signUp(credentials));

    it("opens a new Session for the right password", async () => {
      const result = await service.signIn(credentials);

      expect(result.account.email).toBe(credentials.email);
      expect(sessions.rows).toHaveLength(2);
    });

    it("rejects a wrong password", async () => {
      await expect(service.signIn({ ...credentials, password: "wrong password" })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejects an unknown email with the same error as a wrong password", async () => {
      const unknown = service.signIn({ email: "nobody@example.com", password: credentials.password });

      await expect(unknown).rejects.toThrow("Invalid email or password");
    });
  });

  describe("authenticate", () => {
    it("resolves the Account behind a live Session token", async () => {
      const { account, session } = await service.signUp(credentials);

      expect(await service.authenticate(session.token)).toEqual(account);
    });

    it("answers undefined for an unknown token", async () => {
      expect(await service.authenticate("not-a-token")).toBeUndefined();
    });

    it("answers undefined once the Session has expired", async () => {
      const { session } = await service.signUp(credentials);
      const stored = sessions.rows[0];

      if (stored) {
        stored.expiresAt = new Date(Date.now() - 1);
      }

      expect(await service.authenticate(session.token)).toBeUndefined();
    });
  });

  describe("signOut", () => {
    it("revokes the Session so its token no longer authenticates", async () => {
      const { session } = await service.signUp(credentials);

      await service.signOut(session.token);

      expect(await service.authenticate(session.token)).toBeUndefined();
    });
  });
});
