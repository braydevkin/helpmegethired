import type { Id } from "@helpmegethired/shared";

export interface ResumeExtractionJob {
  uploadedResumeId: Id;
  maxAttempts: number;
}

export abstract class ResumeExtractionQueue {
  abstract enqueue(job: ResumeExtractionJob): Promise<void>;
}
