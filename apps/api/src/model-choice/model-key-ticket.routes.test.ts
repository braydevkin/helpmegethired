import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import {
  ApiErrorSchema,
  MODEL_KEY_TICKET_LIFETIME_SECONDS,
  ModelKeyTicketSchema,
  type Account,
  type AccountModelChoice,
  type Id,
  type ModelChoiceRequest,
} from "@helpmegethired/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AccountRepository } from "../auth/account.repository";
import { AuthService } from "../auth/auth.service";
import { SessionGuard } from "../auth/session.guard";
import { Clock } from "../common/clock";
import { ModelKeyRefusedError } from "./model-choice-errors";
import { ModelChoiceController } from "./model-choice.controller";
import { ModelChoiceService } from "./model-choice.service";
import { ModelKeyTicketRepository } from "./model-key-ticket.repository";
import { ModelKeyTicketService } from "./model-key-ticket.service";
import { InMemoryModelKeyTickets, MovableClock } from "./testing/model-key-ticket-doubles";

const REFUSED_KEY = "sk-ant-refused-by-the-provider-in-this-test";
const choice = { provider: "anthropic", modelId: "claude-sonnet-5" } as const;

const accountOf = (id: Id): Account => ({
  id,
  email: `${id}@candidate.example`,
  name: null,
  lastName: null,
  phone: null,
  address: null,
  createdAt: new Date().toISOString(),
});

const keyOf = (label: string) => `sk-ant-api03-${label}-${randomUUID()}`;
const codeOf = (body: unknown) => ApiErrorSchema.parse(body).code;

describe("the Model Key ticket on the Model Choice routes", () => {
  const owner = accountOf(randomUUID());
  const other = accountOf(randomUUID());
  const sessions = new Map([
    ["owner-session", owner],
    ["other-session", other],
  ]);
  const accounts = new Map([owner, other].map((account) => [account.id, account]));
  const saved: { accountId: Id; key: string }[] = [];
  const clock = new MovableClock();
  const tickets = new InMemoryModelKeyTickets();
  let app: INestApplication;
  let baseUrl: string;

  const choices = {
    get: () => Promise.resolve({ choice: null }),
    save: (accountId: Id, { provider, modelId, key }: ModelChoiceRequest): Promise<AccountModelChoice> => {
      if (key === REFUSED_KEY) {
        return Promise.reject(new ModelKeyRefusedError("model_key_invalid"));
      }

      saved.push({ accountId, key });

      return Promise.resolve({ provider, modelId, keyStored: true });
    },
    revokeKey: () => Promise.resolve({ ...choice, keyStored: false }),
  };

  const send = async (method: string, path: string, bearer?: string, body?: unknown): Promise<{ status: number; body: unknown }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return { status: response.status, body: await response.json() };
  };

  const ticketFor = async (session: string) => ModelKeyTicketSchema.parse((await send("POST", "/account/model/key-ticket", session)).body).ticket;
  const saveWithTicket = (ticket: string, key: string) => send("PUT", "/account/model", ticket, { ...choice, key });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ModelChoiceController],
      providers: [
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: AuthService, useValue: { authenticate: (token: string) => Promise.resolve(sessions.get(token)) } },
        { provide: AccountRepository, useValue: { findById: (id: Id) => Promise.resolve(accounts.get(id)) } },
        { provide: ModelChoiceService, useValue: choices },
        { provide: ModelKeyTicketRepository, useValue: tickets },
        { provide: Clock, useValue: clock },
        ModelKeyTicketService,
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    saved.length = 0;
  });

  it("issues a ticket to a Session", async () => {
    const answer = await send("POST", "/account/model/key-ticket", "owner-session");

    expect(answer.status).toBe(201);
    expect(ModelKeyTicketSchema.safeParse(answer.body).success).toBe(true);
  });

  it("lets a request with no Session store a key for the ticket's Account", async () => {
    const key = keyOf("stored");
    const answer = await saveWithTicket(await ticketFor("owner-session"), key);

    expect(answer.status).toBe(200);
    expect(answer.body).toEqual({ ...choice, keyStored: true });
    expect(saved).toEqual([{ accountId: owner.id, key }]);
  });

  it("stores the key for the Account that asked for the ticket and no other", async () => {
    await saveWithTicket(await ticketFor("other-session"), keyOf("other"));

    expect(saved.map(({ accountId }) => accountId)).toEqual([other.id]);
  });

  it("works once", async () => {
    const ticket = await ticketFor("owner-session");

    await saveWithTicket(ticket, keyOf("first"));
    const second = await saveWithTicket(ticket, keyOf("second"));

    expect(second.status).toBe(401);
    expect(codeOf(second.body)).toBe("model_key_ticket_invalid");
    expect(saved).toHaveLength(1);
  });

  it("is spent by a key the Provider refuses", async () => {
    const ticket = await ticketFor("owner-session");
    const refused = await saveWithTicket(ticket, REFUSED_KEY);
    const retried = await saveWithTicket(ticket, keyOf("retried"));

    expect(refused.status).toBe(422);
    expect(retried.status).toBe(401);
    expect(codeOf(retried.body)).toBe("model_key_ticket_invalid");
    expect(saved).toEqual([]);
  });

  it("is spent by a body that does not pass the schema", async () => {
    const ticket = await ticketFor("owner-session");
    const malformed = await saveWithTicket(ticket, "sk-ant-short");
    const retried = await saveWithTicket(ticket, keyOf("retried"));

    expect(malformed.status).toBe(400);
    expect(retried.status).toBe(401);
  });

  it("is refused once its minute is over", async () => {
    const ticket = await ticketFor("owner-session");

    clock.advance(MODEL_KEY_TICKET_LIFETIME_SECONDS);
    const answer = await saveWithTicket(ticket, keyOf("late"));

    expect(answer.status).toBe(401);
    expect(codeOf(answer.body)).toBe("model_key_ticket_invalid");
    expect(saved).toEqual([]);
  });

  it("is refused by every other route and stays unspent", async () => {
    const ticket = await ticketFor("owner-session");

    for (const [method, path] of [
      ["GET", "/account/model"],
      ["DELETE", "/account/model/key"],
      ["POST", "/account/model/key-ticket"],
    ] as const) {
      const answer = await send(method, path, ticket);

      expect(answer.status).toBe(401);
      expect(codeOf(answer.body)).toBeUndefined();
    }

    expect((await saveWithTicket(ticket, keyOf("unspent"))).status).toBe(200);
  });

  it.each([
    ["no credential", undefined],
    ["an unknown ticket", "an-unknown-ticket"],
    ["a Session that is not live", "stale-session"],
  ])("answers %s on the key route with the ticket code", async (_label, bearer) => {
    const answer = await send("PUT", "/account/model", bearer, { ...choice, key: keyOf("refused") });

    expect(answer.status).toBe(401);
    expect(codeOf(answer.body)).toBe("model_key_ticket_invalid");
    expect(saved).toEqual([]);
  });

  it("still takes the Session on the key route", async () => {
    const answer = await send("PUT", "/account/model", "owner-session", { ...choice, key: keyOf("session") });

    expect(answer.status).toBe(200);
    expect(saved.map(({ accountId }) => accountId)).toEqual([owner.id]);
  });
});
