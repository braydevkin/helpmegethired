import { describe, expect, it } from "vitest";

import { SCANNED_DETECTION_MIN_BYTES, SCANNED_DETECTION_MIN_CHARACTERS, looksScanned } from "./scanned-detection";

const largeFile = SCANNED_DETECTION_MIN_BYTES + 1;
const smallFile = SCANNED_DETECTION_MIN_BYTES;

describe("looksScanned", () => {
  it("flags a large file that yields almost no text", () => {
    expect(looksScanned("", largeFile)).toBe(true);
    expect(looksScanned("\n\n \t \f\n", largeFile)).toBe(true);
    expect(looksScanned("a".repeat(SCANNED_DETECTION_MIN_CHARACTERS - 1), largeFile)).toBe(true);
  });

  it("counts characters without the blanks between them", () => {
    const spaced = Array.from({ length: SCANNED_DETECTION_MIN_CHARACTERS }, () => "a").join(" \n");

    expect(looksScanned(spaced, largeFile)).toBe(false);
  });

  it("keeps a small file whatever its text", () => {
    expect(looksScanned("", smallFile)).toBe(false);
  });

  it("keeps a large file with enough text", () => {
    expect(looksScanned("a".repeat(SCANNED_DETECTION_MIN_CHARACTERS), largeFile)).toBe(false);
  });
});
