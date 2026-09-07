import type { JobsOptions, Queue } from "bullmq";

import { withTimeout } from "../common/with-timeout";

// The row is already committed when the job is added, so a Redis outage must cost the request
// a bounded wait and a log line, never a hang.
export const ENQUEUE_TIMEOUT_MS = 5_000;

export function addBounded<Data>(
  queue: Queue<Data>,
  name: Parameters<Queue<Data>["add"]>[0],
  data: Parameters<Queue<Data>["add"]>[1],
  options: JobsOptions,
  subject: string,
): Promise<void> {
  return withTimeout(queue.add(name, data, options), ENQUEUE_TIMEOUT_MS, `Adding the job of ${subject} to ${queue.name}`).then(
    () => undefined,
  );
}
