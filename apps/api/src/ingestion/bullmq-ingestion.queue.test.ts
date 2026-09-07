import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeoutError } from "../common/with-timeout";
import { ENQUEUE_TIMEOUT_MS } from "../queue/bounded-add";
import { BullMqIngestionQueue } from "./bullmq-ingestion.queue";
import type { IngestionJob } from "./ingestion-queue";

const job: IngestionJob = { ingestionId: "0d4a1f64-1a5e-4f0e-9d2b-2f1c0d6a7b8c", maxAttempts: 3 };
const settings = { concurrency: 1, lockDurationMs: 30_000, stalledIntervalMs: 30_000 };

function queueWhoseAdd(add: Queue<IngestionJob>["add"]): Queue<IngestionJob> {
  return { name: "profile-ingestion", opts: { prefix: "bull" }, add } as unknown as Queue<IngestionJob>;
}

describe("BullMqIngestionQueue.enqueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds one job named for the run with the Ingestion id and the options of the row", async () => {
    const add = vi.fn().mockResolvedValue({ id: job.ingestionId });
    const queue = new BullMqIngestionQueue(queueWhoseAdd(add), { url: "redis://redis:6379" }, settings);

    await queue.enqueue(job);

    expect(add).toHaveBeenCalledWith("run", job, expect.objectContaining({ jobId: job.ingestionId, attempts: 3 }));
  });

  it("gives up after the enqueue timeout when Redis does not answer, naming the Ingestion", async () => {
    const add = vi.fn(() => new Promise<never>(() => undefined));
    const queue = new BullMqIngestionQueue(queueWhoseAdd(add), { url: "redis://redis:6379" }, settings);
    const pending = queue.enqueue(job);
    const outcome = expect(pending).rejects.toThrow(TimeoutError);

    await vi.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS);

    await outcome;
    await expect(pending).rejects.toThrow(`Adding the job of Ingestion ${job.ingestionId} to profile-ingestion`);
  });
});
