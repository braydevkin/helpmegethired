import { randomUUID } from "node:crypto";

import type { ExecutionContext } from "@nestjs/common";
import type { Account } from "@helpmegethired/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { AccountRepository } from "../auth/account.repository";
import { ModelKeyTicketInvalidError } from "./model-choice-errors";
import { ModelKeyTicketGuard } from "./model-key-ticket.guard";
import type { ModelKeyTicketRepository } from "./model-key-ticket.repository";
import { ModelKeyTicketService } from "./model-key-ticket.service";
import { InMemoryModelKeyTickets, MovableClock } from "./testing/model-key-ticket-doubles";

const accountOf = (id: string): Account => ({
  id,
  email: `${id}@candidate.example`,
  name: null,
  lastName: null,
  phone: null,
  address: null,
  createdAt: new Date().toISOString(),
});

interface GuardedRequest {
  headers: { authorization?: string };
  account?: Account;
}

const contextFor = (request: GuardedRequest) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe("ModelKeyTicketGuard", () => {
  const account = accountOf(randomUUID());
  let tickets: InMemoryModelKeyTickets;
  let service: ModelKeyTicketService;
  let known: Map<string, Account>;
  let guard: ModelKeyTicketGuard;

  beforeEach(() => {
    tickets = new InMemoryModelKeyTickets();
    service = new ModelKeyTicketService(tickets as unknown as ModelKeyTicketRepository, new MovableClock());
    known = new Map([[account.id, account]]);
    guard = new ModelKeyTicketGuard(service, { findById: (id: string) => Promise.resolve(known.get(id)) } as unknown as AccountRepository);
  });

  it("lets a request the Session already resolved through without spending anything", async () => {
    const { ticket } = await service.issue(account.id);
    const request: GuardedRequest = { headers: { authorization: `Bearer ${ticket}` }, account };

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(tickets.heldBy(account.id)).toBe(1);
  });

  it("resolves the Account from a bearer ticket and spends it", async () => {
    const { ticket } = await service.issue(account.id);
    const request: GuardedRequest = { headers: { authorization: `Bearer ${ticket}` } };

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(request.account).toEqual(account);
    expect(tickets.heldBy(account.id)).toBe(0);
  });

  it.each([
    ["no Authorization header", undefined],
    ["another scheme", "Basic abc"],
    ["an unknown ticket", "Bearer an-unknown-ticket"],
  ])("refuses a request with %s", async (_label, authorization) => {
    await expect(guard.canActivate(contextFor({ headers: { authorization } }))).rejects.toThrow(ModelKeyTicketInvalidError);
  });

  it("refuses a ticket whose Account is gone", async () => {
    const { ticket } = await service.issue(account.id);

    known.clear();

    await expect(guard.canActivate(contextFor({ headers: { authorization: `Bearer ${ticket}` } }))).rejects.toThrow(ModelKeyTicketInvalidError);
  });
});
