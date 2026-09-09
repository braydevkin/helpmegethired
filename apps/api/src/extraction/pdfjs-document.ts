import { InvalidPDFException, PasswordException, VerbosityLevel, getDocument, version } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

import { corruptPdf, encryptedPdf } from "./extraction-errors";

export const PDFJS_VERSION = `pdfjs-dist/${version}`;

export type DocumentUse<Result> = (document: PDFDocumentProxy) => Promise<Result>;

// Fonts are never materialised and nothing is rendered: the document is opened for its
// structure and its text only.
const openingOptions = {
  disableFontFace: true,
  useSystemFonts: false,
  verbosity: VerbosityLevel.ERRORS,
};

function refusal(error: unknown): Error {
  if (error instanceof PasswordException) {
    return encryptedPdf();
  }

  if (error instanceof InvalidPDFException) {
    return corruptPdf(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function withPdfDocument<Result>(bytes: Buffer, use: DocumentUse<Result>): Promise<Result> {
  const loading = getDocument({ data: new Uint8Array(bytes), ...openingOptions });

  try {
    return await use(await loading.promise);
  } catch (error) {
    throw refusal(error);
  } finally {
    await loading.destroy();
  }
}
