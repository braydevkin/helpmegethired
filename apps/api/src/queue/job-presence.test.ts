import type { Job, Queue } from "bullmq";
import { describe, expect, it } from "vitest";

import { hasPendingJob, removeFinishedJob } from "./job-presence";

const queueHolding = (state?: string): Queue =>
  ({
    getJob: () => Promise.resolve(state === undefined ? undefined : ({ getState: () => Promise.resolve(state) } as unknown as Job)),
  }) as unknown as Queue;

const queueTrackingRemoval = (state: string): { queue: Queue; removed: () => boolean } => {
  let wasRemoved = false;
  const job = {
    getState: () => Promise.resolve(state),
    remove: () => {
      wasRemoved = true;
      return Promise.resolve();
    },
  } as unknown as Job;

  return { queue: { getJob: () => Promise.resolve(job) } as unknown as Queue, removed: () => wasRemoved };
};

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

describe("removeFinishedJob", () => {
  it.each(["completed", "failed", "unknown"])("removes a %s job so its id can be added again", async (state) => {
    const { queue, removed } = queueTrackingRemoval(state);

    await removeFinishedJob(queue, "job");

    expect(removed()).toBe(true);
  });

  it.each(["waiting", "active", "delayed", "prioritized", "waiting-children"])("keeps a %s job", async (state) => {
    const { queue, removed } = queueTrackingRemoval(state);

    await removeFinishedJob(queue, "job");

    expect(removed()).toBe(false);
  });

  it("does nothing when the queue holds no job with the id", async () => {
    await expect(removeFinishedJob(queueHolding(), "job")).resolves.toBeUndefined();
  });
});
