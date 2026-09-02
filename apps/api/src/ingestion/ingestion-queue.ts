import type { Id } from "@helpmegethired/shared";

import type { Database } from "../database/database";

export interface IngestionJob {
  ingestionId: Id;
  maxAttempts: number;
}

export type IngestionJobHandler = (job: IngestionJob) => Promise<void>;

export abstract class IngestionQueue {
  abstract enqueue(job: IngestionJob, transaction: Database): Promise<void>;
  abstract work(handler: IngestionJobHandler): Promise<void>;
}
