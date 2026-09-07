import type { Queue } from "bullmq";
import { describe, expect, it } from "vitest";

import { workerOptionsFor } from "./bullmq-consumer";

const queue = { name: "profile-ingestion", opts: { prefix: "test" } } as Queue;
const connection = { url: "redis://localhost:6379", maxRetriesPerRequest: null };
const settings = { concurrency: 4, lockDurationMs: 30_000, stalledIntervalMs: 15_000 };

describe("workerOptionsFor", () => {
  it("maps the worker settings onto the BullMQ options under the queue's prefix", () => {
    expect(workerOptionsFor(queue, connection, settings, 3)).toEqual({
      connection,
      prefix: "test",
      concurrency: 4,
      lockDuration: 30_000,
      stalledInterval: 15_000,
      maxStalledCount: 2,
    });
  });

  it("recovers a stalled job one time fewer than the row allows attempts", () => {
    expect(workerOptionsFor(queue, connection, settings, 1).maxStalledCount).toBe(0);
  });
});
