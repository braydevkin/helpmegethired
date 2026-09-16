import { Injectable, Logger } from "@nestjs/common";
import type { Id, ProfileRecognitionReceipt } from "@helpmegethired/shared";

import { CurationRepository } from "../curation/curation.repository";
import type { Database } from "../database/database";
import { IngestionAlreadyActiveError } from "../ingestion/ingestion-errors";
import { IngestionRepository } from "../ingestion/ingestion.repository";
import { IngestionService } from "../ingestion/ingestion.service";
import { ModelKeyNotFoundError } from "../model-choice/model-choice-errors";
import { ModelChoiceService } from "../model-choice/model-choice.service";
import { UploadInFlightError } from "../resumes/resume-errors";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { ProfileRecognitionRefusedError } from "./profile-recognition-errors";
import { resumeSegmentsOf } from "./segments/resume-segments";
import { RESUME_SOURCE } from "./profile.service";

interface ReadableResume {
  id: Id;
  text: string;
}

// The PDF is deleted once its text is stored, so the Profile is read again from that text. It is a
// new Ingestion like an upload's, so its progress, the replacement of the rows, and the
// supersession of the Curation all follow the path an upload already takes.
@Injectable()
export class ProfileRecognitionService {
  private readonly logger = new Logger(ProfileRecognitionService.name);

  constructor(
    private readonly modelChoices: ModelChoiceService,
    private readonly ingestionRecords: IngestionRepository,
    private readonly ingestions: IngestionService,
    private readonly resumes: UploadedResumeRepository,
    private readonly curations: CurationRepository,
  ) {}

  async start(accountId: Id): Promise<ProfileRecognitionReceipt> {
    await this.requireModelKey(accountId);

    if (await this.ingestionRecords.hasActive(accountId)) {
      throw new ProfileRecognitionRefusedError("ingestion_active");
    }

    const resume = await this.readableResumeOf(accountId);

    try {
      const ingestion = await this.ingestions.start(
        { accountId, source: RESUME_SOURCE, segments: resumeSegmentsOf(resume.text, resume.id) },
        (created, transaction) => this.relink(accountId, resume.id, created.id, transaction),
      );

      this.logger.log(`profile recognition started resume=${resume.id} ingestion=${ingestion.id}`);
    } catch (error) {
      throw error instanceof IngestionAlreadyActiveError || error instanceof UploadInFlightError ? new ProfileRecognitionRefusedError("ingestion_active") : error;
    }

    return { uploadedResumeId: resume.id };
  }

  private async requireModelKey(accountId: Id): Promise<void> {
    try {
      await this.modelChoices.usableModelKey(accountId);
    } catch (error) {
      throw error instanceof ModelKeyNotFoundError ? new ProfileRecognitionRefusedError("model_key_missing") : error;
    }
  }

  private async readableResumeOf(accountId: Id): Promise<ReadableResume> {
    const ingestion = await this.ingestionRecords.findLatestCompleted(accountId, RESUME_SOURCE);
    const resume = ingestion && (await this.resumes.findReadBy(accountId, ingestion.id));
    const text = resume && (await this.resumes.extractedTextOf(accountId, resume.id));

    if (!resume || !text) {
      throw new ProfileRecognitionRefusedError("resume_text_missing");
    }

    return { id: resume.id, text };
  }

  // Runs after the new Ingestion took the Account lock, which starting a Curation also takes, so
  // no Curation can start between this check and the commit.
  private async relink(accountId: Id, uploadedResumeId: Id, ingestionId: Id, transaction: Database): Promise<void> {
    if (await this.curations.findActive(accountId, transaction)) {
      throw new ProfileRecognitionRefusedError("curation_active");
    }

    if (!(await this.resumes.restartReading(accountId, uploadedResumeId, ingestionId, transaction))) {
      throw new ProfileRecognitionRefusedError("ingestion_active");
    }
  }
}
