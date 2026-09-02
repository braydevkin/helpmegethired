import { randomUUID } from "node:crypto";

import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Account, AuthenticatedAccount, Credentials } from "@helpmegethired/shared";

import { AccountRepository, DuplicateEmailError } from "./account.repository";
import { PasswordHasher } from "./password-hasher";
import { SessionRepository } from "./session.repository";
import { generateSessionToken, hashSessionToken } from "./session-token";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly unmatchablePasswordHash: Promise<string>;

  constructor(
    private readonly accounts: AccountRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {
    this.unmatchablePasswordHash = passwordHasher.hash(randomUUID());
  }

  async signUp({ email, password }: Credentials): Promise<AuthenticatedAccount> {
    const passwordHash = await this.passwordHasher.hash(password);

    try {
      const account = await this.accounts.create({ email, passwordHash });

      return this.openSession(account);
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictException("An Account with this email already exists");
      }

      throw error;
    }
  }

  async signIn({ email, password }: Credentials): Promise<AuthenticatedAccount> {
    const stored = await this.accounts.findCredentialsByEmail(email);
    const passwordHash = stored?.passwordHash ?? (await this.unmatchablePasswordHash);
    const matches = await this.passwordHasher.verify(password, passwordHash);

    if (!stored || !matches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.openSession(stored.account);
  }

  authenticate(token: string): Promise<Account | undefined> {
    return this.sessions.findAccountByTokenHash(hashSessionToken(token), new Date());
  }

  signOut(token: string): Promise<void> {
    return this.sessions.deleteByTokenHash(hashSessionToken(token));
  }

  private async openSession(account: Account): Promise<AuthenticatedAccount> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

    await this.sessions.create({ accountId: account.id, tokenHash: hashSessionToken(token), expiresAt });

    return { account, session: { token, expiresAt: expiresAt.toISOString() } };
  }
}
