import { Injectable } from "@nestjs/common";

import { IngestionService } from "../ingestion/ingestion.service";
import { resumeSegmentsOf } from "../profile/segments/resume-segments";
import { UploadedResumeRunRepository, type ExtractionRecord } from "./uploaded-resume-run.repository";

// What happens to a record once its text is stored and its object deleted.
export abstract class ExtractionHandover {
  abstract handOver(record: ExtractionRecord): Promise<void>;
}

export class ExtractedTextMissingError extends Error {
  constructor(uploadedResumeId: string) {
    super(`The Uploaded Resume ${uploadedResumeId} has no extracted text to hand over`);
    this.name = "ExtractedTextMissingError";
  }
}

// The sections of the stored text become the Segments of one Ingestion, linked to the record
// in the same transaction, so a re-delivered job finds the link and never starts a second one.
@Injectable()
export class ResumeIngestionHandover extends ExtractionHandover {
  constructor(
    private readonly repository: UploadedResumeRunRepository,
    private readonly ingestions: IngestionService,
  ) {
    super();
  }

  async handOver(record: ExtractionRecord): Promise<void> {
    if (record.ingestionId !== null) {
      return;
    }

    if (record.rawText === null) {
      throw new ExtractedTextMissingError(record.id);
    }

    await this.ingestions.start(
      { accountId: record.accountId, source: "upload", segments: resumeSegmentsOf(record.rawText, record.id) },
      (ingestion, transaction) => this.repository.attachIngestion(record.id, ingestion.id, transaction),
    );
  }
}
