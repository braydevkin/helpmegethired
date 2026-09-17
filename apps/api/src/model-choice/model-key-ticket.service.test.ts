import { randomUUID } from "node:crypto";

import { MODEL_KEY_TICKET_LIFETIME_SECONDS, ModelKeyTicketSchema } from "@helpmegethired/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { ModelKeyTicketInvalidError } from "./model-choice-errors";
import type { ModelKeyTicketRepository } from "./model-key-ticket.repository";
import { ModelKeyTicketService, modelKeyTicketHashOf } from "./model-key-ticket.service";
import { InMemoryModelKeyTickets, MovableClock } from "./testing/model-key-ticket-doubles";

describe("ModelKeyTicketService", () => {
  const accountId = randomUUID();
  let clock: MovableClock;
  let tickets: InMemoryModelKeyTickets;
  let service: ModelKeyTicketService;

  beforeEach(() => {
    clock = new MovableClock(new Date("2026-09-11T12:00:00.000Z"));
    tickets = new InMemoryModelKeyTickets();
    service = new ModelKeyTicketService(tickets as unknown as ModelKeyTicketRepository, clock);
  });

  it("issues a ticket the shared schema accepts, expiring a minute on, and keeps only its hash", async () => {
    const issued = await service.issue(accountId);

    expect(ModelKeyTicketSchema.parse(issued)).toEqual(issued);
    expect(issued.expiresAt).toBe(new Date(clock.now().getTime() + MODEL_KEY_TICKET_LIFETIME_SECONDS * 1000).toISOString());
    expect([...tickets.rows.keys()]).toEqual([modelKeyTicketHashOf(issued.ticket)]);
    expect(JSON.stringify([...tickets.rows])).not.toContain(issued.ticket);
  });

  it("issues a different ticket every time", async () => {
    const first = await service.issue(accountId);
    const second = await service.issue(accountId);

    expect(first.ticket).not.toBe(second.ticket);
  });

  it("redeems a ticket once, for the Account that asked for it", async () => {
    const { ticket } = await service.issue(accountId);

    await expect(service.redeem(ticket)).resolves.toBe(accountId);
    await expect(service.redeem(ticket)).rejects.toThrow(ModelKeyTicketInvalidError);
  });

  it("redeems a ticket until its minute is over and refuses it from then on", async () => {
    const early = await service.issue(accountId);
    const late = await service.issue(accountId);

    clock.advance(MODEL_KEY_TICKET_LIFETIME_SECONDS - 1);
    await expect(service.redeem(early.ticket)).resolves.toBe(accountId);

    clock.advance(1);
    await expect(service.redeem(late.ticket)).rejects.toThrow(ModelKeyTicketInvalidError);
    expect(tickets.heldBy(accountId)).toBe(0);
  });

  it("answers an unknown, a used, and an expired ticket the same way, without naming the ticket", async () => {
    const used = await service.issue(accountId);
    const expired = await service.issue(accountId);

    await service.redeem(used.ticket);
    clock.advance(MODEL_KEY_TICKET_LIFETIME_SECONDS);

    const refusalOf = async (ticket: string): Promise<ModelKeyTicketInvalidError> => {
      try {
        await service.redeem(ticket);
      } catch (error) {
        return error as ModelKeyTicketInvalidError;
      }

      throw new Error("The ticket was redeemed");
    };

    const refusals = await Promise.all(["an-unknown-ticket", used.ticket, expired.ticket].map(refusalOf));

    expect(new Set(refusals.map(({ message, code }) => `${code}: ${message}`)).size).toBe(1);
    expect(refusals[0]?.code).toBe("model_key_ticket_invalid");
    for (const refusal of refusals) {
      expect(refusal.message).not.toContain(used.ticket);
      expect(refusal.message).not.toContain(expired.ticket);
    }
  });
});
