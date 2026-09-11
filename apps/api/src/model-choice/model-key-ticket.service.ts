import { createHash, randomBytes } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { MODEL_KEY_TICKET_LIFETIME_SECONDS, type Id, type ModelKeyTicket } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import { ModelKeyTicketInvalidError } from "./model-choice-errors";
import { ModelKeyTicketRepository } from "./model-key-ticket.repository";

const TICKET_BYTES = 32;

export const modelKeyTicketHashOf = (ticket: string): string => createHash("sha256").update(ticket).digest("hex");

// Log lines carry the Account id only, never the ticket (docs/security.md).
@Injectable()
export class ModelKeyTicketService {
  private readonly logger = new Logger(ModelKeyTicketService.name);

  constructor(
    private readonly tickets: ModelKeyTicketRepository,
    private readonly clock: Clock,
  ) {}

  async issue(accountId: Id): Promise<ModelKeyTicket> {
    const ticket = randomBytes(TICKET_BYTES).toString("base64url");
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + MODEL_KEY_TICKET_LIFETIME_SECONDS * 1000);

    await this.tickets.create({ accountId, tokenHash: modelKeyTicketHashOf(ticket), expiresAt }, now);
    this.logger.log(`Model Key ticket issued for Account ${accountId}`);

    return { ticket, expiresAt: expiresAt.toISOString() };
  }

  // The ticket is spent before anything else looks at the request, so a key the Provider
  // refuses needs a fresh ticket.
  async redeem(ticket: string): Promise<Id> {
    const taken = await this.tickets.take(modelKeyTicketHashOf(ticket));

    if (!taken || taken.expiresAt <= this.clock.now()) {
      this.logger.warn("Model Key ticket refused");
      throw new ModelKeyTicketInvalidError();
    }

    this.logger.log(`Model Key ticket redeemed for Account ${taken.accountId}`);

    return taken.accountId;
  }
}
