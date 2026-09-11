import type { Id } from "@helpmegethired/shared";

export interface CurationJob {
  curationId: Id;
  maxAttempts: number;
}

export type CurationJobHandler = (job: CurationJob) => Promise<void>;

export abstract class CurationQueue {
  abstract enqueue(job: CurationJob): Promise<void>;
  abstract work(handler: CurationJobHandler): Promise<void>;
  abstract hasPendingJob(curationId: Id): Promise<boolean>;
}
