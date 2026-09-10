import { randomUUID } from "node:crypto";

import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AccountModelChoiceSchema, ApiErrorSchema, ModelChoiceStateSchema, SESSION_LIFETIME_SECONDS } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { SessionRepository } from "../auth/session.repository";
import { hashSessionToken } from "../auth/session-token";
import { DATABASE, type Database } from "../database/database";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { QUEUE_PREFIX } from "../queue/queues";
import { DEVELOPMENT_REFUSED_MODEL_KEY, DEVELOPMENT_UNAVAILABLE_MODEL_KEY } from "./development-model-key-validator";
import { ModelKeyNotFoundError } from "./model-choice-errors";
import { ModelChoiceRepository } from "./model-choice.repository";
import { ModelChoiceService } from "./model-choice.service";
import { ModelKeyCipher } from "./model-key-cipher";

const choice = { provider: "anthropic", modelId: "claude-sonnet-5" } as const;
const keyOf = (label: string) => `sk-ant-api03-${label}-${randomUUID()}`;

describe("the Account's Model Choice and Model Key", () => {
  let app: INestApplication;
  let baseUrl: string;
  let database: Database;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let repository: ModelChoiceRepository;
  let service: ModelChoiceService;
  let cipher: ModelKeyCipher;
  const written: string[] = [];
  const keysSent: string[] = [];

  const request = async (method: string, path: string, token: string, body?: unknown): Promise<{ status: number; text: string }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: typeof body === "string" || body === undefined ? body : JSON.stringify(body),
    });

    return { status: response.status, text: await response.text() };
  };

  const saveChoice = (token: string, key: string) => {
    keysSent.push(key);

    return request("PUT", "/account/model", token, { ...choice, key });
  };

  const openSession = async (): Promise<{ accountId: string; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });
    const token = randomUUID();

    await sessions.create({ accountId: account.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000) });

    return { accountId: account.id, token };
  };

  const capture = (stream: NodeJS.WriteStream) => {
    const original = stream.write.bind(stream);

    vi.spyOn(stream, "write").mockImplementation(((chunk: string | Uint8Array, ...rest: never[]) => {
      written.push(String(chunk));

      return original(chunk, ...rest);
    }) as typeof stream.write);
  };

  const captureLogger = (level: "log" | "warn" | "error") => {
    const original = Logger.prototype[level];

    vi.spyOn(Logger.prototype, level).mockImplementation(function (this: Logger, message: unknown, ...rest: unknown[]) {
      written.push([message, ...rest].map(String).join(" "));

      return original.call(this, message, ...rest);
    } as never);
  };

  beforeAll(async () => {
    capture(process.stdout);
    capture(process.stderr);
    captureLogger("log");
    captureLogger("warn");
    captureLogger("error");

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(QUEUE_PREFIX).useValue(`test-${randomUUID()}`).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    database = app.get<Database>(DATABASE);
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
    repository = app.get(ModelChoiceRepository);
    service = app.get(ModelChoiceService);
    cipher = app.get(ModelKeyCipher);
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("answers no choice before the Candidate makes one", async () => {
    const { token } = await openSession();
    const answer = await request("GET", "/account/model", token);

    expect(answer.status).toBe(200);
    expect(ModelChoiceStateSchema.parse(JSON.parse(answer.text))).toEqual({ choice: null });
  });

  it("stores the key encrypted, answers only that one is stored, and gives the key back only to the service", async () => {
    const { accountId, token } = await openSession();
    const key = keyOf("stored");
    const saved = await saveChoice(token, key);
    const read = await request("GET", "/account/model", token);

    expect(saved.status).toBe(200);
    expect(AccountModelChoiceSchema.parse(JSON.parse(saved.text))).toEqual({ ...choice, keyStored: true });
    expect(saved.text).not.toContain(key);
    expect(read.text).toBe(JSON.stringify({ choice: { ...choice, keyStored: true } }));

    const row = await database.selectFrom("account_model_choices").selectAll().where("account_id", "=", accountId).executeTakeFirstOrThrow();

    expect(row.sealed_key?.includes(Buffer.from(key))).toBe(false);
    expect(cipher.open(accountId, row.sealed_key ?? Buffer.alloc(0))).toBe(key);

    const usable = await service.usableModelKey(accountId);

    expect(usable.key.reveal()).toBe(key);
    expect(JSON.stringify(usable)).not.toContain(key);
  });

  it("replaces an earlier key with a new one", async () => {
    const { accountId, token } = await openSession();

    await saveChoice(token, keyOf("first"));
    const second = keyOf("second");

    expect((await saveChoice(token, second)).status).toBe(200);
    expect((await service.usableModelKey(accountId)).key.reveal()).toBe(second);
  });

  it("refuses a key the Provider does not accept, with a code, and keeps the key that works", async () => {
    const { accountId, token } = await openSession();
    const working = keyOf("working");

    await saveChoice(token, working);
    const refused = await saveChoice(token, DEVELOPMENT_REFUSED_MODEL_KEY);

    expect(refused.status).toBe(422);
    expect(ApiErrorSchema.parse(JSON.parse(refused.text)).code).toBe("model_key_invalid");
    expect(refused.text).not.toContain(DEVELOPMENT_REFUSED_MODEL_KEY);
    expect((await service.usableModelKey(accountId)).key.reveal()).toBe(working);
  });

  it("tells an unreachable Provider apart from an invalid key", async () => {
    const { token } = await openSession();
    const answer = await saveChoice(token, DEVELOPMENT_UNAVAILABLE_MODEL_KEY);

    expect(answer.status).toBe(503);
    expect(ApiErrorSchema.parse(JSON.parse(answer.text)).code).toBe("provider_unavailable");
    expect(ModelChoiceStateSchema.parse(JSON.parse((await request("GET", "/account/model", token)).text))).toEqual({ choice: null });
  });

  it.each([
    ["another provider", { provider: "openai", modelId: "claude-sonnet-5" }, "unsupported_model_choice"],
    ["a model outside the catalogue", { provider: "anthropic", modelId: "claude-opus-5" }, "unsupported_model_choice"],
  ])("refuses %s with a code and without echoing the key", async (_label, pairing, code) => {
    const { token } = await openSession();
    const key = keyOf("unsupported");

    keysSent.push(key);
    const answer = await request("PUT", "/account/model", token, { ...pairing, key });

    expect(answer.status).toBe(400);
    expect(ApiErrorSchema.parse(JSON.parse(answer.text)).code).toBe(code);
    expect(answer.text).not.toContain(key);
  });

  it("names a key that is too short without echoing it", async () => {
    const { token } = await openSession();
    const answer = await saveChoice(token, "sk-ant-too-short");

    expect(answer.status).toBe(400);
    expect(ApiErrorSchema.parse(JSON.parse(answer.text)).issues?.map(({ path }) => path)).toEqual(["key"]);
    expect(answer.text).not.toContain("sk-ant-too-short");
  });

  it("does not echo a key from a body that is not JSON", async () => {
    const { token } = await openSession();
    const key = keyOf("malformed");

    keysSent.push(key);
    const answer = await request("PUT", "/account/model", token, `{"provider":"anthropic","modelId":"claude-sonnet-5","key":"${key}`);

    expect(answer.status).toBe(400);
    expect(answer.text).not.toContain(key.slice(0, 24));
  });

  it("revokes the key, keeps the choice, and leaves nothing to create a Curation with", async () => {
    const { accountId, token } = await openSession();

    await saveChoice(token, keyOf("revoked"));
    const revoked = await request("DELETE", "/account/model/key", token);

    expect(revoked.status).toBe(200);
    expect(AccountModelChoiceSchema.parse(JSON.parse(revoked.text))).toEqual({ ...choice, keyStored: false });
    expect(JSON.parse((await request("GET", "/account/model", token)).text)).toEqual({ choice: { ...choice, keyStored: false } });
    await expect(service.usableModelKey(accountId)).rejects.toThrow(ModelKeyNotFoundError);
    await expect(service.usableModelKey(accountId)).rejects.toMatchObject({ code: "model_key_missing" });
  });

  it("answers 404 when revoking a key for an Account that never chose", async () => {
    const { token } = await openSession();

    expect((await request("DELETE", "/account/model/key", token)).status).toBe(404);
  });

  describe("scoped to one Account", () => {
    it("reads, revokes, and hands out a key only for the owner", async () => {
      const pair = await createAccountPair(database);

      await repository.save(pair.owner, { ...choice, sealedKey: cipher.seal(pair.owner, keyOf("owner")) });

      await expectScopedToAccount(pair, (accountId) => repository.find(accountId));
      await expectScopedToAccount(pair, async (accountId) => (await service.get(accountId)).choice ?? undefined);
      await expectScopedToAccount(pair, (accountId) => service.usableModelKey(accountId));
      await expectScopedToAccount(pair, (accountId) => repository.revokeKey(accountId));
    });

    it("never lets one Account's save touch another's choice", async () => {
      const pair = await createAccountPair(database);
      const ownerKey = keyOf("owner");

      await repository.save(pair.owner, { ...choice, sealedKey: cipher.seal(pair.owner, ownerKey) });
      await repository.save(pair.other, { ...choice, sealedKey: cipher.seal(pair.other, keyOf("other")) });

      expect((await service.usableModelKey(pair.owner)).key.reveal()).toBe(ownerKey);
    });

    it("never opens a sealed key moved onto another Account's row", async () => {
      const pair = await createAccountPair(database);

      await repository.save(pair.other, { ...choice, sealedKey: cipher.seal(pair.owner, keyOf("moved")) });

      await expect(service.usableModelKey(pair.other)).rejects.toThrow("A stored Model Key could not be decrypted");
    });

    it("goes when the Account is deleted", async () => {
      const pair = await createAccountPair(database);

      await repository.save(pair.owner, { ...choice, sealedKey: cipher.seal(pair.owner, keyOf("deleted")) });
      await database.deleteFrom("accounts").where("id", "=", pair.owner).execute();

      expect(await repository.find(pair.owner)).toBeUndefined();
    });
  });

  it("wrote log lines about the choices and none of the keys", () => {
    const output = written.join("");

    expect(output).toContain("Model Choice saved for Account");
    expect(output).toContain("Model Key refused for Account");
    for (const key of keysSent) {
      expect(output).not.toContain(key);
    }
  });
});
