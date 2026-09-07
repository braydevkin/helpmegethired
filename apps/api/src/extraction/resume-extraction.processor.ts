import { Injectable, Logger } from "@nestjs/common";
import { RESUME_MAX_PAGES, RESUME_MAX_SIZE_BYTES, type Id } from "@helpmegethired/shared";

import { UploadedResumeNotFoundError } from "../resumes/resume-errors";
import { ObjectStorage } from "../storage/object-storage";
import { RejectedPdfError, notPdf, scannedPdf, tooLarge, tooManyPages } from "./extraction-errors";
import { ExtractionHandover } from "./extraction-handover";
import { PdfInspector } from "./pdf-inspector";
import { hasPdfSignature } from "./pdf-signature";
import { StreamTooLongError, readBounded } from "./read-bounded";
import { looksScanned } from "./scanned-detection";
import { TextExtractor, type ExtractedText } from "./text-extractor";
import { UploadedResumeRunRepository, type ExtractionRecord } from "./uploaded-resume-run.repository";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

@Injectable()
export class ResumeExtractionProcessor {
  private readonly logger = new Logger(ResumeExtractionProcessor.name);

  constructor(
    private readonly repository: UploadedResumeRunRepository,
    private readonly storage: ObjectStorage,
    private readonly inspector: PdfInspector,
    private readonly extractor: TextExtractor,
    private readonly handover: ExtractionHandover,
  ) {}

  async process(uploadedResumeId: Id): Promise<void> {
    const record = await this.repository.findById(uploadedResumeId);

    if (!record) {
      throw new UploadedResumeNotFoundError(uploadedResumeId);
    }

    if (record.status === "done") {
      return;
    }

    if (record.status === "processing" && record.rawText !== null) {
      return this.finish(record);
    }

    const attempt = await this.repository.beginAttempt(record.id);

    if (!attempt) {
      return this.settleWithoutAttempt(record);
    }

    try {
      await this.finish(await this.repository.saveText(attempt.id, await this.extract(attempt)));
    } catch (error) {
      await this.fail(attempt, error);
    }
  }

  private async extract(record: ExtractionRecord): Promise<ExtractedText> {
    const bytes = await this.download(record);

    if (!hasPdfSignature(bytes)) {
      throw notPdf();
    }

    const { pages } = await this.inspector.inspect(bytes);

    if (pages > RESUME_MAX_PAGES) {
      throw tooManyPages(pages);
    }

    const extracted = await this.extractor.extract(bytes);

    if (looksScanned(extracted.text, bytes.length)) {
      throw scannedPdf();
    }

    return extracted;
  }

  // The whole object is held in memory because a PDF's page tree sits at its end, and the size
  // limit bounds what is held.
  private async download(record: ExtractionRecord): Promise<Buffer> {
    try {
      return await readBounded(await this.storage.getStream(record.objectKey), RESUME_MAX_SIZE_BYTES);
    } catch (error) {
      throw error instanceof StreamTooLongError ? tooLarge() : error;
    }
  }

  // The text is already stored, so the object goes and the record moves on; a re-delivered job
  // lands here and never extracts twice.
  private async finish(record: ExtractionRecord): Promise<void> {
    await this.deleteObject(record);
    await this.handover.handOver(record);
  }

  private async fail(record: ExtractionRecord, error: unknown): Promise<void> {
    if (error instanceof RejectedPdfError) {
      await this.repository.markFailed(record.id, error.code, error.message);
      await this.deleteObject(record);
      this.logger.warn(`Uploaded Resume ${record.id} failed with ${error.code}`);

      return;
    }

    const message = messageOf(error);

    if (record.attempts >= record.maxAttempts) {
      await this.repository.markFailed(record.id, "extraction_failed", message);
      await this.deleteObject(record);
    } else {
      await this.repository.recordError(record.id, message);
    }

    this.logger.warn(`Uploaded Resume ${record.id} failed on attempt ${record.attempts} of ${record.maxAttempts}: ${message}`);

    throw error;
  }

  // A record that is uploaded or processing but got no attempt has used them all.
  private async settleWithoutAttempt(record: ExtractionRecord): Promise<void> {
    if (record.status !== "uploaded" && record.status !== "processing") {
      this.logger.log(`Uploaded Resume ${record.id} is ${record.status}; nothing to extract`);

      return;
    }

    await this.repository.markFailed(record.id, "extraction_failed", `Every one of the ${record.maxAttempts} attempts was used`);
    await this.deleteObject(record);
    this.logger.warn(`Uploaded Resume ${record.id} failed with extraction_failed after ${record.attempts} attempts`);
  }

  // The reconciliation job sweeps objects a failed delete leaves behind, so the delete never
  // decides the outcome of the run.
  private async deleteObject(record: ExtractionRecord): Promise<void> {
    try {
      await this.storage.delete(record.objectKey);
    } catch (error) {
      this.logger.error(`The object of the Uploaded Resume ${record.id} could not be deleted`, error);
    }
  }
}
