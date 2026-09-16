import { randomUUID } from "node:crypto";

import type { ResumeUpload } from "@helpmegethired/shared";
import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../database/transaction-runner";
import type { IngestionRepository } from "../ingestion/ingestion.repository";
import { ModelKeyNotFoundError } from "../model-choice/model-choice-errors";
import type { ModelChoiceService } from "../model-choice/model-choice.service";
import { ModelKey } from "../model-choice/model-key";
import type { ObjectStorage } from "../storage/object-storage";
import type { ResumeExtractionQueue } from "./resume-extraction-queue";
import type { StoredResume } from "./uploaded-resume.mapper";
import type { UploadedResumeRepository } from "./uploaded-resume.repository";
import { UploadedResumeService } from "./uploaded-resume.service";

const accountId = randomUUID();
const upload: ResumeUpload = { fileName: "ada-lovelace.pdf", sizeBytes: 184_320, sha256: "a".repeat(64) };

type NewResume = ResumeUpload & Pick<StoredResume, "id" | "objectKey" | "maxAttempts">;

const pendingResumeOf = (owner: string, record: NewResume): StoredResume => ({
  ...record,
  accountId: owner,
  createdAt: "2026-09-16T12:00:00.000Z",
  source: "upload",
  contentType: "application/pdf",
  status: "pending",
  errorCode: null,
  finishedAt: null,
  ingestionId: null,
});

function serviceWith(usableModelKey: ModelChoiceService["usableModelKey"]) {
  const repository = {
    findLiveBySha256: vi.fn().mockResolvedValue(undefined),
    create: vi.fn((owner: string, record: NewResume) => Promise.resolve(pendingResumeOf(owner, record))),
  };
  const storage = {
    presignPut: vi.fn().mockResolvedValue({ url: "https://storage.test/object", headers: {}, expiresAt: new Date("2026-09-16T12:05:00.000Z") }),
  };
  const service = new UploadedResumeService(
    {} as TransactionRunner,
    repository as unknown as UploadedResumeRepository,
    {} as IngestionRepository,
    storage as unknown as ObjectStorage,
    {} as ResumeExtractionQueue,
    { usableModelKey } as ModelChoiceService,
  );

  return { service, repository, storage };
}

describe("UploadedResumeService.requestUpload", () => {
  it("refuses an Account with no usable Model Key before reading or writing anything", async () => {
    const { service, repository, storage } = serviceWith(() => Promise.reject(new ModelKeyNotFoundError(accountId)));

    await expect(service.requestUpload(accountId, upload)).rejects.toMatchObject({ code: "model_key_missing" });
    expect(repository.findLiveBySha256).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(storage.presignPut).not.toHaveBeenCalled();
  });

  it("reserves the record once the Account has a usable Model Key", async () => {
    const usableModelKey = vi.fn<ModelChoiceService["usableModelKey"]>().mockResolvedValue({
      provider: "anthropic",
      modelId: "claude-sonnet-5",
      key: new ModelKey("sk-ant-api03-a-key-nobody-should-see-again"),
    });
    const { service, repository } = serviceWith(usableModelKey);

    const { created, receipt } = await service.requestUpload(accountId, upload);

    expect(usableModelKey).toHaveBeenCalledWith(accountId);
    expect(repository.create).toHaveBeenCalledWith(accountId, expect.objectContaining({ sha256: upload.sha256 }));
    expect(created).toBe(true);
    expect(receipt.upload).toMatchObject({ method: "PUT", url: "https://storage.test/object" });
  });
});
