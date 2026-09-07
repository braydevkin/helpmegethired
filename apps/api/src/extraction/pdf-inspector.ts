import { Injectable } from "@nestjs/common";

import { withPdfDocument } from "./pdfjs-document";

export interface PdfFacts {
  pages: number;
}

// Opens the document without extracting anything, to refuse encrypted, unreadable, and
// oversized documents before a child process ever sees the bytes.
@Injectable()
export class PdfInspector {
  inspect(bytes: Buffer): Promise<PdfFacts> {
    return withPdfDocument(bytes, async (document) => ({ pages: document.numPages }));
  }
}
