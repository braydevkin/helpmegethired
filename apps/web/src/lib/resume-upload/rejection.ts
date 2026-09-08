import { PDF_CONTENT_TYPE, RESUME_MAX_SIZE_BYTES } from "@helpmegethired/shared";

const MEGABYTE = 1024 * 1024;

export const RESUME_MAX_SIZE_MB = RESUME_MAX_SIZE_BYTES / MEGABYTE;

export const NOT_PDF_MESSAGE = "That file is not a PDF. Export your résumé as PDF and try again.";
export const TOO_LARGE_MESSAGE = `That PDF is over ${RESUME_MAX_SIZE_MB} MB. Compress it or remove heavy images.`;

export interface CandidateFile {
  name: string;
  type: string;
  size: number;
}

const isPdf = (file: CandidateFile): boolean => file.type === PDF_CONTENT_TYPE || file.name.toLowerCase().endsWith(".pdf");

// The browser's own checks, before anything is sent; the API and the worker repeat them.
export function rejectionOf(file: CandidateFile): string | undefined {
  if (!isPdf(file)) {
    return NOT_PDF_MESSAGE;
  }

  if (file.size > RESUME_MAX_SIZE_BYTES) {
    return TOO_LARGE_MESSAGE;
  }

  return undefined;
}
