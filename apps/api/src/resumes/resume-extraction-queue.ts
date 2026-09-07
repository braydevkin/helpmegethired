import type { Id } from "@helpmegethired/shared";

export interface ResumeExtractionJob {
  uploadedResumeId: Id;
  maxAttempts: number;
}

export type ResumeExtractionJobHandler = (job: ResumeExtractionJob) => Promise<void>;

export abstract class ResumeExtractionQueue {
  abstract enqueue(job: ResumeExtractionJob): Promise<void>;
  abstract work(handler: ResumeExtractionJobHandler): Promise<void>;
}
