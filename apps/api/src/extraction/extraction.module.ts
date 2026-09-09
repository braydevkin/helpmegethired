import { Module } from "@nestjs/common";

import { IngestionModule } from "../ingestion/ingestion.module";
import { StorageModule } from "../storage/storage.module";
import { ExtractionHandover, ResumeIngestionHandover } from "./extraction-handover";
import { PdfInspector } from "./pdf-inspector";
import { PdfTextExtractor } from "./pdf-text-extractor";
import { PdfjsTextExtractor } from "./pdfjs-text-extractor";
import { PopplerTextExtractor, popplerSettingsProvider } from "./poppler-text-extractor";
import { ResumeExtractionProcessor } from "./resume-extraction.processor";
import { TextExtractor } from "./text-extractor";
import { UploadedResumeRunRepository } from "./uploaded-resume-run.repository";

@Module({
  imports: [StorageModule, IngestionModule],
  providers: [
    UploadedResumeRunRepository,
    PdfInspector,
    popplerSettingsProvider,
    PopplerTextExtractor,
    PdfjsTextExtractor,
    { provide: TextExtractor, useClass: PdfTextExtractor },
    { provide: ExtractionHandover, useClass: ResumeIngestionHandover },
    ResumeExtractionProcessor,
  ],
  exports: [ResumeExtractionProcessor, PopplerTextExtractor, UploadedResumeRunRepository],
})
export class ExtractionModule {}
