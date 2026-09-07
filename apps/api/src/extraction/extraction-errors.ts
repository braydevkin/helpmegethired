import { RESUME_MAX_PAGES, RESUME_MAX_SIZE_BYTES, type ResumeUploadErrorCode } from "@helpmegethired/shared";

// The file itself is refused; another attempt would refuse it again, so the record fails at once.
export class RejectedPdfError extends Error {
  constructor(
    readonly code: ResumeUploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RejectedPdfError";
  }
}

export const notPdf = () => new RejectedPdfError("not_pdf", "The bytes do not start with the PDF signature");

export const tooLarge = () => new RejectedPdfError("too_large", `The object is larger than ${RESUME_MAX_SIZE_BYTES} bytes`);

export const tooManyPages = (pages: number) =>
  new RejectedPdfError("too_many_pages", `The document has ${pages} pages, more than the ${RESUME_MAX_PAGES} allowed`);

export const encryptedPdf = () => new RejectedPdfError("encrypted_pdf", "The document is password-protected");

export const corruptPdf = (reason: string) => new RejectedPdfError("corrupt_pdf", `The document cannot be read: ${reason}`);

export const scannedPdf = () => new RejectedPdfError("scanned_pdf", "The document holds images and no extractable text");

// pdftotext is not installed where the worker runs; the in-process extractor takes over.
export class ExtractorUnavailableError extends Error {
  constructor(command: string, cause: unknown) {
    super(`${command} cannot be started`, { cause });
    this.name = "ExtractorUnavailableError";
  }
}

// pdftotext stopped for a reason that is not the file's: a signal, or an exit code it reserves
// for its own errors. The in-process extractor takes over.
export class ExtractorFailedError extends Error {
  constructor(command: string, outcome: string, detail: string) {
    super(`${command} ${outcome}${detail ? `: ${detail}` : ""}`);
    this.name = "ExtractorFailedError";
  }
}
