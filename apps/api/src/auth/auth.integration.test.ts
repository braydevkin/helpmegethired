import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccountSchema, ApiErrorSchema, AuthenticatedAccountSchema } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";

const password = "correct horse battery";

const freshEmail = () => `${crypto.randomUUID()}@candidate.example`;

describe("auth endpoints", () => {
  let app: INestApplication;
  let baseUrl: string;

  const post = (path: string, body: unknown, token?: string) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const get = (path: string, token?: string) =>
    fetch(`${baseUrl}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

  const signUp = async (email = freshEmail()) => {
    const response = await post("/auth/sign-up", { email, password });

    expect(response.status).toBe(201);

    return AuthenticatedAccountSchema.parse(await response.json());
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/sign-up", () => {
    it("creates an Account and answers with it and a Session", async () => {
      const email = freshEmail();

      const { account, session } = await signUp(email);

      expect(account.email).toBe(email);
      expect(session.token).not.toBe("");
    });

    it("rejects a second sign up with the same email", async () => {
      const email = freshEmail();

      await signUp(email);
      const response = await post("/auth/sign-up", { email, password });

      expect(response.status).toBe(409);
      expect(ApiErrorSchema.parse(await response.json()).message).toContain("already exists");
    });

    it("rejects an invalid body naming the fields without echoing the values", async () => {
      const response = await post("/auth/sign-up", { email: "ada", password: "s3cret" });
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(ApiErrorSchema.parse(JSON.parse(text)).issues).toEqual([
        { path: "email", message: expect.any(String) },
        { path: "password", message: expect.any(String) },
      ]);
      expect(text).not.toContain("s3cret");
    });
  });

  describe("POST /auth/sign-in", () => {
    it("answers with a new Session for the right password", async () => {
      const email = freshEmail();
      const signedUp = await signUp(email);

      const response = await post("/auth/sign-in", { email, password });

      expect(response.status).toBe(200);

      const signedIn = AuthenticatedAccountSchema.parse(await response.json());

      expect(signedIn.account).toEqual(signedUp.account);
      expect(signedIn.session.token).not.toBe(signedUp.session.token);
    });

    it("rejects a wrong password", async () => {
      const email = freshEmail();

      await signUp(email);
      const response = await post("/auth/sign-in", { email, password: "wrong password" });

      expect(response.status).toBe(401);
    });

    it("rejects an unknown email the same way", async () => {
      const response = await post("/auth/sign-in", { email: freshEmail(), password });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/account", () => {
    it("answers 401 without credentials", async () => {
      expect((await get("/auth/account")).status).toBe(401);
    });

    it("answers 401 for a token that has no Session", async () => {
      expect((await get("/auth/account", "not-a-session")).status).toBe(401);
    });

    it("answers the Account behind the Session", async () => {
      const { account, session } = await signUp();

      const response = await get("/auth/account", session.token);

      expect(response.status).toBe(200);
      expect(AccountSchema.parse(await response.json())).toEqual(account);
    });
  });

  describe("POST /auth/sign-out", () => {
    it("revokes the Session so the token stops working", async () => {
      const { session } = await signUp();

      const signedOut = await post("/auth/sign-out", {}, session.token);

      expect(signedOut.status).toBe(204);
      expect((await get("/auth/account", session.token)).status).toBe(401);
    });

    it("answers 401 without a Session", async () => {
      expect((await post("/auth/sign-out", {})).status).toBe(401);
    });
  });

  it("keeps GET /health public", async () => {
    expect((await get("/health")).status).toBe(200);
  });
});
