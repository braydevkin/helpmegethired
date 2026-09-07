import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { PopplerTextExtractor } from "../extraction/poppler-text-extractor";
import { ResumeExtractionProcessor } from "../extraction/resume-extraction.processor";
import { ResumeExtractionQueue } from "../resumes/resume-extraction-queue";

@Injectable()
export class ResumeExtractionWorker implements OnModuleInit {
  private readonly logger = new Logger(ResumeExtractionWorker.name);

  constructor(
    private readonly queue: ResumeExtractionQueue,
    private readonly processor: ResumeExtractionProcessor,
    private readonly poppler: PopplerTextExtractor,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reportExtractor();
    await this.queue.work((job) => this.processor.process(job.uploadedResumeId));
  }

  private async reportExtractor(): Promise<void> {
    try {
      this.logger.log(`Extracting with ${this.poppler.executable} ${await this.poppler.versionInstalled()}`);
    } catch (error) {
      this.logger.warn(`${(error as Error).message}; every extraction falls back to pdfjs-dist`);
    }
  }
}
