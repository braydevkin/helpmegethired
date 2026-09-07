import type { ConnectionOptions } from "bullmq";

export const QUEUE_NAMES = {
  profileIngestion: "profile-ingestion",
  resumeExtraction: "resume-extraction",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const PRODUCER_CONNECTION = Symbol("PRODUCER_CONNECTION");
export const CONSUMER_CONNECTION = Symbol("CONSUMER_CONNECTION");
export const QUEUE_PREFIX = Symbol("QUEUE_PREFIX");
export const PROFILE_INGESTION_QUEUE = Symbol("PROFILE_INGESTION_QUEUE");
export const RESUME_EXTRACTION_QUEUE = Symbol("RESUME_EXTRACTION_QUEUE");

export const DEFAULT_QUEUE_PREFIX = "bull";

// A request must be answered even while Redis is down, so a producer's commands keep the
// driver's finite retry count and the caller bounds the wait.
export function producerConnectionFor(redisUrl: string): ConnectionOptions {
  return { url: redisUrl };
}

// A consumer's blocking reads must survive a reconnect, which is what a null retry count
// means to BullMQ.
export function consumerConnectionFor(redisUrl: string): ConnectionOptions {
  return { url: redisUrl, maxRetriesPerRequest: null };
}
