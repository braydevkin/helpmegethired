import { Injectable } from "@nestjs/common";
import type { Ingestion } from "@helpmegethired/shared";

import type { Database } from "../database/database";

// What else happens when an Ingestion ends: `completed` runs inside the transaction that
// marks it so, `failed` after the row says every attempt is used. The modules that own the
// Profile and the Uploaded Resume register theirs when they start.
export abstract class IngestionObserver {
  abstract completed(ingestion: Ingestion, transaction: Database): Promise<void>;

  abstract failed(ingestion: Ingestion): Promise<void>;
}

@Injectable()
export class IngestionObservers {
  private readonly observers: IngestionObserver[] = [];

  register(observer: IngestionObserver): void {
    this.observers.push(observer);
  }

  async completed(ingestion: Ingestion, transaction: Database): Promise<void> {
    for (const observer of this.observers) {
      await observer.completed(ingestion, transaction);
    }
  }

  async failed(ingestion: Ingestion): Promise<void> {
    for (const observer of this.observers) {
      await observer.failed(ingestion);
    }
  }
}
