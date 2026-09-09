import type { JobsOptions } from "bullmq";

import { retryingJobOptions } from "../queue/job-options";
import type { IngestionJob } from "./ingestion-queue";

export const INGESTION_JOB_NAME = "run";

export const jobOptionsFor = (job: IngestionJob): JobsOptions => retryingJobOptions(job.ingestionId, job.maxAttempts);
