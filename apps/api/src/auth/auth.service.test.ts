import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Account, AccountInformation } from "@helpmegethired/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { AccountRepository } from "./account.repository";
import { AuthService } from "./auth.service";
import { SessionRepository, type NewSession } from "./session.repository";
import { hashSessionToken } from "./session-token";

const account: Account = {
  id: crypto.randomUUID(),
  email: "ada@example.com",
  name: null,
  lastName: null,
  phone: null,
  address: null,
  createdAt: new Date().toISOString(),
};

const information: AccountInformation = {
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+44", number: "7700900123" },
  address: null,
};

const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);

class InMemoryAccounts {
  readonly rows: Account[] = [account];

  updateInformation(id: string, update: AccountInformation): Promise<Account | undefined> {
    const index = this.rows.findIndex((row) => row.id === id);
    const stored = this.rows[index];

    if (!stored) {
      return Promise.resolve(undefined);
    }

    const updated = { ...stored, name: update.name, lastName: update.lastName, phone: update.phone, address: update.address };

    this.rows[index] = updated;

    return Promise.resolve(updated);
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

    return Promise.resolve(this.accounts.rows.find((row) => row.id === session?.accountId));
  }

  deleteByTokenHash(tokenHash: string): Promise<void> {
    const index = this.rows.findIndex((row) => row.tokenHash === tokenHash);

    if (index >= 0) {
      this.rows.splice(index, 1);
    }

    return Promise.resolve();
  }
}

describe("AuthService", () => {
  let accounts: InMemoryAccounts;
  let sessions: InMemorySessions;
  let service: AuthService;

  const openSession = async (expiresAt = inAnHour()) => {
    const token = crypto.randomUUID();

    await sessions.create({ accountId: account.id, tokenHash: hashSessionToken(token), expiresAt });

    return token;
  };

  beforeEach(async () => {
    accounts = new InMemoryAccounts();
    sessions = new InMemorySessions(accounts);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountRepository, useValue: accounts },
        { provide: SessionRepository, useValue: sessions },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe("authenticate", () => {
    it("resolves the Account behind a live Session token by its hash", async () => {
      const token = await openSession();

      expect(await service.authenticate(token)).toEqual(account);
    });

    it("answers undefined for an unknown token", async () => {
      expect(await service.authenticate("not-a-token")).toBeUndefined();
    });

    it("answers undefined once the Session has expired", async () => {
      const token = await openSession(new Date(Date.now() - 1));

      expect(await service.authenticate(token)).toBeUndefined();
    });
  });

  describe("signOut", () => {
    it("revokes the Session so its token no longer authenticates", async () => {
      const token = await openSession();

      await service.signOut(token);

      expect(await service.authenticate(token)).toBeUndefined();
    });
  });

  describe("updateInformation", () => {
    it("stores the identity fields on the Account", async () => {
      const updated = await service.updateInformation(account, information);

      expect(updated).toEqual({ ...account, ...information });
      expect(accounts.rows[0]).toEqual(updated);
    });

    it("rejects an Account that no longer exists", async () => {
      const gone = { ...account, id: crypto.randomUUID() };

      await expect(service.updateInformation(gone, information)).rejects.toThrow(UnauthorizedException);
    });
  });
});
