import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccountSchema, ApiErrorSchema, SESSION_LIFETIME_SECONDS, type Account } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "./account.repository";
import { SessionRepository } from "./session.repository";
import { hashSessionToken } from "./session-token";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;

const information = {
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+44", number: "7700 900 123" },
  address: "London, UK",
};

describe("auth endpoints", () => {
  let app: INestApplication;
  let baseUrl: string;
  let accounts: AccountRepository;
  let sessions: SessionRepository;

  const request = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const openSession = async (secondsUntilExpiry = SESSION_LIFETIME_SECONDS): Promise<{ account: Account; token: string }> => {
    const account = await accounts.create({ email: freshEmail() });
    const token = crypto.randomUUID();

    await sessions.create({
      accountId: account.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + secondsUntilExpiry * 1000),
    });

    return { account, token };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /auth/account", () => {
    it("answers 401 without credentials", async () => {
      expect((await request("GET", "/auth/account")).status).toBe(401);
    });

    it("answers 401 for a token that has no Session", async () => {
      expect((await request("GET", "/auth/account", "not-a-session")).status).toBe(401);
    });

    it("answers the Account behind a Session stored by its token hash", async () => {
      const { account, token } = await openSession();

      const response = await request("GET", "/auth/account", token);

      expect(response.status).toBe(200);
      expect(AccountSchema.parse(await response.json())).toEqual(account);
    });

    it("stops accepting a Session once it has expired", async () => {
      const { token } = await openSession(-1);

      expect((await request("GET", "/auth/account", token)).status).toBe(401);
    });
  });

  describe("PATCH /auth/account", () => {
    it("stores the identity information and answers the updated Account", async () => {
      const { account, token } = await openSession();

      const response = await request("PATCH", "/auth/account", token, information);

      expect(response.status).toBe(200);
      expect(AccountSchema.parse(await response.json())).toEqual({
        ...account,
        ...information,
        phone: { countryCode: "+44", number: "7700900123" },
      });
    });

    it("stores an omitted address as null", async () => {
      const { token } = await openSession();
      const { name, lastName, phone } = information;

      const response = await request("PATCH", "/auth/account", token, { name, lastName, phone });

      expect(response.status).toBe(200);
      expect(AccountSchema.parse(await response.json()).address).toBeNull();
    });

    it("rejects an empty name or last name naming the fields without echoing the values", async () => {
      const { token } = await openSession();

      const response = await request("PATCH", "/auth/account", token, {
        ...information,
        name: "  ",
        lastName: "",
        phone: { countryCode: "+44", number: "s3cret" },
      });
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(ApiErrorSchema.parse(JSON.parse(text)).issues).toEqual([
        { path: "name", message: "Name is required" },
        { path: "lastName", message: "Last name is required" },
        { path: "phone.number", message: expect.any(String) },
      ]);
      expect(text).not.toContain("s3cret");
    });

    it("answers 401 without a Session", async () => {
      expect((await request("PATCH", "/auth/account", undefined, information)).status).toBe(401);
    });
  });

  describe("POST /auth/sign-out", () => {
    it("deletes the Session so the token stops working", async () => {
      const { token } = await openSession();

      const signedOut = await request("POST", "/auth/sign-out", token);

      expect(signedOut.status).toBe(204);
      expect((await request("GET", "/auth/account", token)).status).toBe(401);
    });

    it("answers 401 without a Session", async () => {
      expect((await request("POST", "/auth/sign-out")).status).toBe(401);
    });
  });

  it("keeps GET /health public", async () => {
    expect((await request("GET", "/health")).status).toBe(200);
  });
});
