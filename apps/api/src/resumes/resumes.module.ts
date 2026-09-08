import { Module } from "@nestjs/common";

import { IngestionModule } from "../ingestion/ingestion.module";
import { QueueModule } from "../queue/queue.module";
import { StorageModule } from "../storage/storage.module";
import { BullMqResumeExtractionQueue } from "./bullmq-resume-extraction.queue";
import { ResumeExtractionQueue } from "./resume-extraction-queue";
import { ResumesController } from "./resumes.controller";
import { UploadedResumeRepository } from "./uploaded-resume.repository";
import { UploadedResumeService } from "./uploaded-resume.service";

@Module({
  imports: [QueueModule, StorageModule, IngestionModule],
  controllers: [ResumesController],
  providers: [
    UploadedResumeRepository,
    UploadedResumeService,
    { provide: ResumeExtractionQueue, useClass: BullMqResumeExtractionQueue },
  ],
  exports: [UploadedResumeService, UploadedResumeRepository, ResumeExtractionQueue],
})
export class ResumesModule {}
