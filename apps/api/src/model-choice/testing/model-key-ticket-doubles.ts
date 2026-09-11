import type { Id } from "@helpmegethired/shared";

import { Clock } from "../../common/clock";
import type { ModelKeyTicketRepository, NewModelKeyTicket, TakenModelKeyTicket } from "../model-key-ticket.repository";

export class MovableClock extends Clock {
  constructor(private current: Date = new Date()) {
    super();
  }

  now(): Date {
    return this.current;
  }

  advance(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

export class InMemoryModelKeyTickets implements Pick<ModelKeyTicketRepository, "create" | "take"> {
  readonly rows = new Map<string, TakenModelKeyTicket>();

  create({ accountId, tokenHash, expiresAt }: NewModelKeyTicket, now: Date): Promise<void> {
    for (const [hash, row] of this.rows) {
      if (row.accountId === accountId && row.expiresAt <= now) {
        this.rows.delete(hash);
      }
    }

    this.rows.set(tokenHash, { accountId, expiresAt });

    return Promise.resolve();
  }

  take(tokenHash: string): Promise<TakenModelKeyTicket | undefined> {
    const row = this.rows.get(tokenHash);

    this.rows.delete(tokenHash);

    return Promise.resolve(row);
  }

  heldBy(accountId: Id): number {
    return [...this.rows.values()].filter((row) => row.accountId === accountId).length;
  }
}
