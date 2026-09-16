import type { Ingestion } from "@helpmegethired/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurationRepository } from "../curation/curation.repository";
import type { Database } from "../database/database";
import { IngestionAlreadyActiveError } from "../ingestion/ingestion-errors";
import type { IngestionRepository } from "../ingestion/ingestion.repository";
import type { IngestionService, NewIngestion, WithNewIngestion } from "../ingestion/ingestion.service";
import { ModelKeyNotFoundError } from "../model-choice/model-choice-errors";
import type { ModelChoiceService } from "../model-choice/model-choice.service";
import { UploadInFlightError } from "../resumes/resume-errors";
import type { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import type { StoredResume } from "../resumes/uploaded-resume.mapper";
import { apiErrorOf } from "./profile-recognition-error.filter";
import { ProfileRecognitionRefusedError } from "./profile-recognition-errors";
import { ProfileRecognitionService } from "./profile-recognition.service";
import { resumeSegmentsOf } from "./segments/resume-segments";

const accountId = "11111111-1111-4111-8111-111111111111";
const completedIngestionId = "22222222-2222-4222-8222-222222222222";
const newIngestionId = "33333333-3333-4333-8333-333333333333";
const uploadedResumeId = "44444444-4444-4444-8444-444444444444";
const transaction = {} as Database;
const text = "Ada Lovelace\nEXPERIENCE\nSenior Backend Engineer\nAnalytical Engines Ltd\n2021 - Present";

const setUp = () => {
  const modelChoices = { usableModelKey: vi.fn().mockResolvedValue({}) };
  const ingestionRecords = { hasActive: vi.fn().mockResolvedValue(false), findLatestCompleted: vi.fn().mockResolvedValue({ id: completedIngestionId }) };
  const ingestions = {
    start: vi.fn(async (_ingestion: unknown, withIngestion?: WithNewIngestion) => {
      const created = { id: newIngestionId } as Ingestion;

      await withIngestion?.(created, transaction);

      return created;
    }),
  };
  const resumes = {
    findReadBy: vi.fn().mockResolvedValue({ id: uploadedResumeId } as StoredResume),
    extractedTextOf: vi.fn().mockResolvedValue(text),
    restartReading: vi.fn().mockResolvedValue({ id: uploadedResumeId } as StoredResume),
  };
  const curations = { findActive: vi.fn().mockResolvedValue(undefined) };
  const service = new ProfileRecognitionService(
    modelChoices as unknown as ModelChoiceService,
    ingestionRecords as unknown as IngestionRepository,
    ingestions as unknown as IngestionService,
    resumes as unknown as UploadedResumeRepository,
    curations as unknown as CurationRepository,
  );

  return { service, modelChoices, ingestionRecords, ingestions, resumes, curations };
};

let fixture: ReturnType<typeof setUp>;

beforeEach(() => {
  fixture = setUp();
});

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ProfileRecognitionRefusedError ? error.code : error),
  );

describe("ProfileRecognitionService", () => {
  it("starts an upload Ingestion over the stored text, links the Uploaded Resume to it, and answers its id", async () => {
    expect(await fixture.service.start(accountId)).toEqual({ uploadedResumeId });

    const [newIngestion] = (fixture.ingestions.start.mock.calls[0] ?? []) as [NewIngestion?];

    expect(newIngestion).toMatchObject({ accountId, source: "upload" });
    expect(newIngestion?.segments).toEqual(resumeSegmentsOf(text, uploadedResumeId));
    expect(fixture.resumes.findReadBy).toHaveBeenCalledWith(accountId, completedIngestionId);
    expect(fixture.curations.findActive).toHaveBeenCalledWith(accountId, transaction);
    expect(fixture.resumes.restartReading).toHaveBeenCalledWith(accountId, uploadedResumeId, newIngestionId, transaction);
  });

  it("refuses with model_key_missing before reading anything when no Model Key is stored", async () => {
    fixture.modelChoices.usableModelKey.mockRejectedValue(new ModelKeyNotFoundError(accountId));

    expect(await refusalOf(fixture.service.start(accountId))).toBe("model_key_missing");
    expect(fixture.ingestionRecords.findLatestCompleted).not.toHaveBeenCalled();
    expect(fixture.ingestions.start).not.toHaveBeenCalled();
  });

  it("lets any other failure to open the key through unchanged", async () => {
    const broken = new Error("cipher failure");

    fixture.modelChoices.usableModelKey.mockRejectedValue(broken);

    expect(await refusalOf(fixture.service.start(accountId))).toBe(broken);
  });

  it.each([
    ["no Profile has been built", () => fixture.ingestionRecords.findLatestCompleted.mockResolvedValue(undefined)],
    ["no Uploaded Resume is behind the Profile", () => fixture.resumes.findReadBy.mockResolvedValue(undefined)],
    ["the Uploaded Resume has no stored text", () => fixture.resumes.extractedTextOf.mockResolvedValue(undefined)],
  ])("refuses with resume_text_missing when %s", async (_case, arrange) => {
    arrange();

    expect(await refusalOf(fixture.service.start(accountId))).toBe("resume_text_missing");
    expect(fixture.ingestions.start).not.toHaveBeenCalled();
  });

  it("refuses with ingestion_active before looking for the text while an Ingestion is queued or running", async () => {
    fixture.ingestionRecords.hasActive.mockResolvedValue(true);

    expect(await refusalOf(fixture.service.start(accountId))).toBe("ingestion_active");
    expect(fixture.ingestionRecords.findLatestCompleted).not.toHaveBeenCalled();
    expect(fixture.ingestions.start).not.toHaveBeenCalled();
  });

  it.each([
    ["another Ingestion started meanwhile", () => fixture.ingestions.start.mockRejectedValue(new IngestionAlreadyActiveError(accountId))],
    ["another upload is in flight", () => fixture.resumes.restartReading.mockRejectedValue(new UploadInFlightError(accountId))],
    ["the Uploaded Resume is not settled", () => fixture.resumes.restartReading.mockResolvedValue(undefined)],
  ])("refuses with ingestion_active when %s", async (_case, arrange) => {
    arrange();

    expect(await refusalOf(fixture.service.start(accountId))).toBe("ingestion_active");
  });

  it("refuses with curation_active inside the transaction, before the Uploaded Resume is touched", async () => {
    fixture.curations.findActive.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" });

    expect(await refusalOf(fixture.service.start(accountId))).toBe("curation_active");
    expect(fixture.resumes.restartReading).not.toHaveBeenCalled();
  });
});

describe("the refusal answers", () => {
  it("answers 404 for a Profile with no text to read and 409 for everything in the way", () => {
    expect(apiErrorOf(new ProfileRecognitionRefusedError("resume_text_missing"))).toMatchObject({ statusCode: 404, error: "Not Found", code: "resume_text_missing" });

    for (const code of ["model_key_missing", "ingestion_active", "curation_active"] as const) {
      expect(apiErrorOf(new ProfileRecognitionRefusedError(code))).toMatchObject({ statusCode: 409, error: "Conflict", code });
    }
  });
});
