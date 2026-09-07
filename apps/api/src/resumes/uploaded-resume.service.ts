import { randomUUID } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import {
  PDF_CONTENT_TYPE,
  type Id,
  type PresignedUpload,
  type ResumeUpload,
  type ResumeUploadReceipt,
  type UploadedResume,
  type UploadedResumeStatus,
} from "@helpmegethired/shared";

import { IngestionRepository } from "../ingestion/ingestion.repository";
import { ObjectStorage } from "../storage/object-storage";
import { ResumeExtractionQueue } from "./resume-extraction-queue";
import { UploadIncompleteError, UploadInFlightError, UploadedResumeNotFoundError } from "./resume-errors";
import { resumeObjectKeyFor } from "./resume-object-key";
import { toUploadedResume, type StoredResume } from "./uploaded-resume.mapper";
import { DuplicateUploadError, UploadedResumeRepository } from "./uploaded-resume.repository";

export const EXTRACTION_MAX_ATTEMPTS = 3;

export interface UploadRequestOutcome {
  receipt: ResumeUploadReceipt;
  created: boolean;
}

export interface ObjectPresenceCheck {
  attempts: number;
  retryDelayMs: number;
}

// A store without read-after-write consistency can still be catching up when the browser
// reports the upload finished; three looks half a second apart cover it.
export const OBJECT_PRESENCE_CHECK: ObjectPresenceCheck = { attempts: 3, retryDelayMs: 500 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class UploadedResumeService {
  private readonly logger = new Logger(UploadedResumeService.name);

  constructor(
    private readonly repository: UploadedResumeRepository,
    private readonly ingestions: IngestionRepository,
    private readonly storage: ObjectStorage,
    private readonly extraction: ResumeExtractionQueue,
  ) {}

  async requestUpload(accountId: Id, upload: ResumeUpload): Promise<UploadRequestOutcome> {
    const existing = await this.repository.findLiveBySha256(accountId, upload.sha256);

    if (existing && existing.status !== "pending") {
      return { receipt: { resume: await this.withProgress(existing), upload: null }, created: false };
    }

    const resume = existing ?? (await this.createOrReuse(accountId, upload));

    return {
      receipt: { resume: toUploadedResume(resume, null), upload: await this.presign(resume) },
      created: existing === undefined,
    };
  }

  async complete(accountId: Id, id: Id): Promise<UploadedResume> {
    const resume = await this.stored(accountId, id);

    if (resume.status !== "pending") {
      return this.withProgress(resume);
    }

    await this.assertObjectPresent(resume);

    if (await this.ingestions.hasActive(accountId)) {
      throw new UploadInFlightError(accountId);
    }

    const uploaded = await this.repository.markUploaded(accountId, id);

    if (!uploaded) {
      return this.withProgress(await this.stored(accountId, id));
    }

    await this.enqueueExtraction(uploaded);

    return toUploadedResume(uploaded, null);
  }

  async findById(accountId: Id, id: Id): Promise<UploadedResume> {
    return this.withProgress(await this.stored(accountId, id));
  }

  async list(accountId: Id, status?: UploadedResumeStatus): Promise<UploadedResume[]> {
    const resumes = await this.repository.list(accountId, status);

    return Promise.all(resumes.map((resume) => this.withProgress(resume)));
  }

  private async createOrReuse(accountId: Id, upload: ResumeUpload): Promise<StoredResume> {
    const id = randomUUID();

    try {
      return await this.repository.create(accountId, {
        ...upload,
        id,
        objectKey: resumeObjectKeyFor(accountId, id),
        maxAttempts: EXTRACTION_MAX_ATTEMPTS,
      });
    } catch (error) {
      if (error instanceof DuplicateUploadError) {
        const raced = await this.repository.findLiveBySha256(accountId, upload.sha256);

        if (raced) {
          return raced;
        }
      }

      throw error;
    }
  }

  private async presign(resume: StoredResume): Promise<PresignedUpload> {
    const presigned = await this.storage.presignPut(resume.objectKey, resume.sizeBytes, resume.sha256, PDF_CONTENT_TYPE);

    return { url: presigned.url, method: "PUT", headers: presigned.headers, expiresAt: presigned.expiresAt.toISOString() };
  }

  private async assertObjectPresent(resume: StoredResume): Promise<void> {
    for (let attempt = 1; attempt <= OBJECT_PRESENCE_CHECK.attempts; attempt += 1) {
      const object = await this.storage.head(resume.objectKey);

      if (object?.size === resume.sizeBytes) {
        return;
      }

      if (attempt < OBJECT_PRESENCE_CHECK.attempts) {
        await sleep(OBJECT_PRESENCE_CHECK.retryDelayMs);
      }
    }

    throw new UploadIncompleteError(resume.id);
  }

  // The row is committed before the job is added; a failed enqueue is logged and left to the
  // reconciliation job, never surfaced as a request error.
  private async enqueueExtraction(resume: StoredResume): Promise<void> {
    try {
      await this.extraction.enqueue({ uploadedResumeId: resume.id, maxAttempts: resume.maxAttempts });
    } catch (error) {
      this.logger.error(`Uploaded Resume ${resume.id} is uploaded but its extraction job could not be added`, error);
    }
  }

  private async stored(accountId: Id, id: Id): Promise<StoredResume> {
    const resume = await this.repository.findById(accountId, id);

    if (!resume) {
      throw new UploadedResumeNotFoundError(id);
    }

    return resume;
  }

  private async withProgress(resume: StoredResume): Promise<UploadedResume> {
    const progress = resume.ingestionId ? await this.ingestions.progressOf(resume.accountId, resume.ingestionId) : undefined;

    return toUploadedResume(resume, progress ?? null);
  }
}
