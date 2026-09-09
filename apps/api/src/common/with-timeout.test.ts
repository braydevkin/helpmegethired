import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers with the result when the work settles in time", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1_000, "The work")).resolves.toBe("done");
  });

  it("propagates the failure of the work", async () => {
    await expect(withTimeout(Promise.reject(new Error("broken")), 1_000, "The work")).rejects.toThrow("broken");
  });

  it("rejects with a TimeoutError naming the action once the deadline passes", async () => {
    const pending = withTimeout(new Promise<never>(() => undefined), 1_000, "Adding the job");
    const outcome = expect(pending).rejects.toThrow(TimeoutError);

    await vi.advanceTimersByTimeAsync(1_000);

    await outcome;
    await expect(pending).rejects.toThrow("Adding the job took longer than 1000 ms");
  });
});
