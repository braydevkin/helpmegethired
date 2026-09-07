import type { ConnectionOptions } from "bullmq";

export const QUEUE_NAMES = {
  profileIngestion: "profile-ingestion",
  resumeExtraction: "resume-extraction",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_CONNECTION = Symbol("QUEUE_CONNECTION");
export const QUEUE_PREFIX = Symbol("QUEUE_PREFIX");
export const PROFILE_INGESTION_QUEUE = Symbol("PROFILE_INGESTION_QUEUE");
export const RESUME_EXTRACTION_QUEUE = Symbol("RESUME_EXTRACTION_QUEUE");

export const DEFAULT_QUEUE_PREFIX = "bull";

// Blocking commands on a worker must not give up while Redis reconnects, which is what a
// finite retry count would make them do.
export function queueConnectionFor(redisUrl: string): ConnectionOptions {
  return { url: redisUrl, maxRetriesPerRequest: null };
}
