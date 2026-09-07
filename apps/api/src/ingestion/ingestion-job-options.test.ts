import { describe, expect, it } from "vitest";

import { jobOptionsFor } from "./ingestion-job-options";

describe("jobOptionsFor", () => {
  const options = jobOptionsFor({ ingestionId: "0d4a1f64-1a5e-4f0e-9d2b-2f1c0d6a7b8c", maxAttempts: 3 });

  it("uses the Ingestion id as the job id so a second add is a no-op", () => {
    expect(options.jobId).toBe("0d4a1f64-1a5e-4f0e-9d2b-2f1c0d6a7b8c");
  });

  it("gives the queue as many attempts as the Ingestion row allows", () => {
    expect(options.attempts).toBe(3);
  });

  it("backs off exponentially between attempts", () => {
    expect(options.backoff).toEqual({ type: "exponential", delay: 1_000 });
  });

  it("keeps failed jobs for the queue dashboard and expires completed ones", () => {
    expect(options.removeOnFail).toBe(false);
    expect(options.removeOnComplete).toEqual({ age: 86_400 });
  });
});
