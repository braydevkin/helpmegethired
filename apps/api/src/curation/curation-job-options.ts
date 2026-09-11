import type { JobsOptions } from "bullmq";

import { retryingJobOptions } from "../queue/job-options";
import type { CurationJob } from "./curation-queue";

export const CURATION_JOB_NAME = "run";

export const CURATION_MAX_ATTEMPTS = 3;

export const jobOptionsFor = (job: CurationJob): JobsOptions => retryingJobOptions(job.curationId, job.maxAttempts);
