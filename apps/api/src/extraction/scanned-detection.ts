const KILOBYTE = 1024;

export const SCANNED_DETECTION_MIN_BYTES = 50 * KILOBYTE;
export const SCANNED_DETECTION_MIN_CHARACTERS = 200;

const BLANK = /\s/g;

const nonBlankCharactersOf = (text: string): number => text.replace(BLANK, "").length;

// A large file that yields almost no text is a scan: the pages are images. OCR is out of this phase.
export const looksScanned = (text: string, sizeBytes: number): boolean =>
  sizeBytes > SCANNED_DETECTION_MIN_BYTES && nonBlankCharactersOf(text) < SCANNED_DETECTION_MIN_CHARACTERS;
