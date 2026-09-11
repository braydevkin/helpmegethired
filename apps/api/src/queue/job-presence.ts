import type { JobState, Queue } from "bullmq";

// A job in one of these states will still be delivered; a completed, failed, or unknown one
// will not, so its row needs the reconciliation job.
const PENDING_STATES: ReadonlySet<JobState | "unknown"> = new Set<JobState>([
  "waiting",
  "active",
  "delayed",
  "prioritized",
  "waiting-children",
]);

const FINISHED_STATES: ReadonlySet<JobState | "unknown"> = new Set<JobState>(["completed", "failed"]);

export async function hasPendingJob(queue: Queue, jobId: string): Promise<boolean> {
  const job = await queue.getJob(jobId);

  return job !== undefined && PENDING_STATES.has(await job.getState());
}

// A finished job keeps its id while it is retained, and an add under a taken id is a no-op, so
// a row that must run again under the same id needs the finished job gone first.
export async function removeFinishedJob(queue: Queue, jobId: string): Promise<void> {
  const job = await queue.getJob(jobId);

  if (job && FINISHED_STATES.has(await job.getState())) {
    await job.remove();
  }
}
