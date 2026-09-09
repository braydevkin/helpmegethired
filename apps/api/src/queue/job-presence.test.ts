import type { Job, Queue } from "bullmq";
import { describe, expect, it } from "vitest";

import { hasPendingJob } from "./job-presence";

const queueHolding = (state?: string): Queue =>
  ({
    getJob: () => Promise.resolve(state === undefined ? undefined : ({ getState: () => Promise.resolve(state) } as unknown as Job)),
  }) as unknown as Queue;

describe("hasPendingJob", () => {
  it.each(["waiting", "active", "delayed", "prioritized", "waiting-children"])("answers true for a %s job", async (state) => {
    expect(await hasPendingJob(queueHolding(state), "job")).toBe(true);
  });

  it.each(["completed", "failed", "unknown"])("answers false for a %s job", async (state) => {
    expect(await hasPendingJob(queueHolding(state), "job")).toBe(false);
  });

  it("answers false when the queue holds no job with the id", async () => {
    expect(await hasPendingJob(queueHolding(), "job")).toBe(false);
  });
});
