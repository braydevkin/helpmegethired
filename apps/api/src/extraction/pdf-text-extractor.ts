import { Injectable, Logger } from "@nestjs/common";

import { ExtractorFailedError, ExtractorUnavailableError } from "./extraction-errors";
import { PdfjsTextExtractor } from "./pdfjs-text-extractor";
import { PopplerTextExtractor } from "./poppler-text-extractor";
import { TextExtractor, type ExtractedText } from "./text-extractor";

const takesOver = (error: unknown): boolean =>
  error instanceof ExtractorUnavailableError || error instanceof ExtractorFailedError;

// pdftotext keeps the layout, which the parser relies on; the in-process extractor answers
// only when pdftotext cannot run or stops for a reason that is not the document's.
@Injectable()
export class PdfTextExtractor extends TextExtractor {
  private readonly logger = new Logger(PdfTextExtractor.name);

  constructor(
    private readonly poppler: PopplerTextExtractor,
    private readonly fallback: PdfjsTextExtractor,
  ) {
    super();
  }

  async extract(bytes: Buffer): Promise<ExtractedText> {
    try {
      return await this.poppler.extract(bytes);
    } catch (error) {
      if (!takesOver(error)) {
        throw error;
      }

      this.logger.warn(`${(error as Error).message}; extracting with ${this.fallback.version}`);

      return this.fallback.extract(bytes);
    }
  }
}
