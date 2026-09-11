import { randomUUID } from "node:crypto";

import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  ApiErrorSchema,
  MODEL_KEY_TICKET_LIFETIME_SECONDS,
  ModelChoiceStateSchema,
  ModelKeyTicketSchema,
  SESSION_LIFETIME_SECONDS,
  type Id,
} from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { SessionRepository } from "../auth/session.repository";
import { hashSessionToken } from "../auth/session-token";
import { Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database";
import { createAccountPair } from "../database/testing/account-pair";
import { QUEUE_PREFIX } from "../queue/queues";
import { DEVELOPMENT_REFUSED_MODEL_KEY } from "./development-model-key-validator";
import { ModelChoiceService } from "./model-choice.service";
import { modelKeyTicketHashOf } from "./model-key-ticket.service";

class ShiftedClock extends Clock {
  shiftSeconds = 0;

  now(): Date {
    return new Date(Date.now() + this.shiftSeconds * 1000);
  }
}

const choice = { provider: "anthropic", modelId: "claude-sonnet-5" } as const;
const keyOf = (label: string) => `sk-ant-api03-${label}-${randomUUID()}`;

describe("the Model Key ticket", () => {
  const clock = new ShiftedClock();
  const written: string[] = [];
  const secrets: string[] = [];
  let app: INestApplication;
  let baseUrl: string;
  let database: Database;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let service: ModelChoiceService;

  const request = async (method: string, path: string, bearer?: string, body?: unknown): Promise<{ status: number; text: string }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return { status: response.status, text: await response.text() };
  };

  const sessionFor = async (accountId: Id): Promise<string> => {
    const token = randomUUID();

    await sessions.create({ accountId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000) });

    return token;
  };

  const openSession = async (): Promise<{ accountId: Id; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });

    return { accountId: account.id, token: await sessionFor(account.id) };
  };

  const issueTicket = async (token: string): Promise<{ ticket: string; expiresAt: string }> => {
    const answer = await request("POST", "/account/model/key-ticket", token);

    expect(answer.status).toBe(201);
    const issued = ModelKeyTicketSchema.parse(JSON.parse(answer.text));

    secrets.push(issued.ticket);

    return issued;
  };

  const saveWithTicket = (ticket: string, key: string) => {
    secrets.push(key);

    return request("PUT", "/account/model", ticket, { ...choice, key });
  };

  const ticketRowsOf = (accountId: Id) => database.selectFrom("model_key_tickets").selectAll().where("account_id", "=", accountId).execute();
  const codeOf = (text: string) => ApiErrorSchema.parse(JSON.parse(text)).code;

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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    database = app.get<Database>(DATABASE);
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
    service = app.get(ModelChoiceService);
  });

  afterEach(() => {
    clock.shiftSeconds = 0;
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("is issued to a Session for a minute and kept only as its hash", async () => {
    const { accountId, token } = await openSession();
    const { ticket, expiresAt } = await issueTicket(token);
    const rows = await ticketRowsOf(accountId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.token_hash).toBe(modelKeyTicketHashOf(ticket));
    expect(JSON.stringify(rows)).not.toContain(ticket);
    expect(rows[0]?.expires_at.toISOString()).toBe(expiresAt);
    expect(Date.parse(expiresAt) - Date.now()).toBeLessThanOrEqual(MODEL_KEY_TICKET_LIFETIME_SECONDS * 1000);
  });

  it("lets a request with no Session store a key for the ticket's Account, then is gone", async () => {
    const { accountId, token } = await openSession();
    const key = keyOf("stored");
    const answer = await saveWithTicket((await issueTicket(token)).ticket, key);

    expect(answer.status).toBe(200);
    expect(answer.text).not.toContain(key);
    expect((await service.usableModelKey(accountId)).key.reveal()).toBe(key);
    expect(await ticketRowsOf(accountId)).toEqual([]);
  });

  it("works once", async () => {
    const { token } = await openSession();
    const { ticket } = await issueTicket(token);

    await saveWithTicket(ticket, keyOf("first"));
    const second = await saveWithTicket(ticket, keyOf("second"));

    expect(second.status).toBe(401);
    expect(codeOf(second.text)).toBe("model_key_ticket_invalid");
  });

  it("is spent by a key the Provider refuses, which stores nothing", async () => {
    const { token } = await openSession();
    const { ticket } = await issueTicket(token);
    const refused = await saveWithTicket(ticket, DEVELOPMENT_REFUSED_MODEL_KEY);
    const retried = await saveWithTicket(ticket, keyOf("retried"));

    expect(refused.status).toBe(422);
    expect(retried.status).toBe(401);
    expect(codeOf(retried.text)).toBe("model_key_ticket_invalid");
    expect(ModelChoiceStateSchema.parse(JSON.parse((await request("GET", "/account/model", token)).text))).toEqual({ choice: null });
  });

  it("is refused once its minute is over", async () => {
    const { accountId, token } = await openSession();
    const { ticket } = await issueTicket(token);

    clock.shiftSeconds = MODEL_KEY_TICKET_LIFETIME_SECONDS;
    const answer = await saveWithTicket(ticket, keyOf("late"));

    expect(answer.status).toBe(401);
    expect(codeOf(answer.text)).toBe("model_key_ticket_invalid");
    await expect(service.usableModelKey(accountId)).rejects.toMatchObject({ code: "model_key_missing" });
  });

  it("is refused by every other route and stays unspent", async () => {
    const { token } = await openSession();
    const { ticket } = await issueTicket(token);

    for (const [method, path] of [
      ["GET", "/account/model"],
      ["DELETE", "/account/model/key"],
      ["POST", "/account/model/key-ticket"],
      ["GET", "/auth/account"],
      ["GET", "/profile/curation"],
    ] as const) {
      expect((await request(method, path, ticket)).status).toBe(401);
    }

    expect((await saveWithTicket(ticket, keyOf("unspent"))).status).toBe(200);
  });

  it("stores a key only for the Account whose ticket it is", async () => {
    const pair = await createAccountPair(database);
    const { ticket } = await issueTicket(await sessionFor(pair.other));
    const key = keyOf("other");

    expect((await saveWithTicket(ticket, key)).status).toBe(200);
    expect((await service.usableModelKey(pair.other)).key.reveal()).toBe(key);
    expect((await service.get(pair.owner)).choice).toBeNull();
  });

  it("drops an Account's expired tickets when it asks for another", async () => {
    const { accountId, token } = await openSession();

    await issueTicket(token);
    clock.shiftSeconds = MODEL_KEY_TICKET_LIFETIME_SECONDS;
    const { ticket } = await issueTicket(token);

    expect((await ticketRowsOf(accountId)).map(({ token_hash }) => token_hash)).toEqual([modelKeyTicketHashOf(ticket)]);
  });

  it("goes when the Account is deleted", async () => {
    const { accountId, token } = await openSession();

    await issueTicket(token);
    await database.deleteFrom("accounts").where("id", "=", accountId).execute();

    expect(await ticketRowsOf(accountId)).toEqual([]);
  });

  it("wrote log lines about the tickets and none of the tickets or keys", () => {
    const output = written.join("");

    expect(output).toContain("Model Key ticket issued for Account");
    expect(output).toContain("Model Key ticket redeemed for Account");
    expect(output).toContain("Model Key ticket refused");
    for (const secret of secrets) {
      expect(output).not.toContain(secret);
    }
  });
});
