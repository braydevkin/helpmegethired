import type { Id } from "@helpmegethired/shared";

export interface IngestionJob {
  ingestionId: Id;
  maxAttempts: number;
}

export type IngestionJobHandler = (job: IngestionJob) => Promise<void>;

export abstract class IngestionQueue {
  abstract enqueue(job: IngestionJob): Promise<void>;
  abstract work(handler: IngestionJobHandler): Promise<void>;
}
