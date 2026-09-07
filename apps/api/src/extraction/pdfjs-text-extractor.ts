import { Injectable } from "@nestjs/common";
import type { PDFDocumentProxy, TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";

import { PDFJS_VERSION, withPdfDocument } from "./pdfjs-document";
import { TextExtractor, type ExtractedText } from "./text-extractor";

const isTextItem = (item: TextItem | TextMarkedContent): item is TextItem => "str" in item;

async function textOfPage(document: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await document.getPage(pageNumber);
  const { items } = await page.getTextContent();

  return items
    .filter(isTextItem)
    .map((item) => (item.hasEOL ? `${item.str}\n` : item.str))
    .join("");
}

@Injectable()
export class PdfjsTextExtractor extends TextExtractor {
  readonly version = PDFJS_VERSION;

  extract(bytes: Buffer): Promise<ExtractedText> {
    return withPdfDocument(bytes, async (document) => {
      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        pages.push(await textOfPage(document, pageNumber));
      }

      return { text: pages.join("\n\f\n"), extractorVersion: this.version };
    });
  }
}
