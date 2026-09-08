import { RESUME_MAX_SIZE_BYTES } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { NOT_PDF_MESSAGE, TOO_LARGE_MESSAGE, rejectionOf } from "./rejection";

describe("rejectionOf", () => {
  it("accepts a PDF within the limit", () => {
    expect(rejectionOf({ name: "ada.pdf", type: "application/pdf", size: RESUME_MAX_SIZE_BYTES })).toBeUndefined();
  });

  it("accepts a file the browser did not type when its name ends in .pdf", () => {
    expect(rejectionOf({ name: "Ada.PDF", type: "", size: 10 })).toBeUndefined();
  });

  it("refuses a PNG with the designed message", () => {
    expect(rejectionOf({ name: "ada.png", type: "image/png", size: 10 })).toBe(NOT_PDF_MESSAGE);
  });

  it("refuses a 6 MB PDF with the limit from the shared package", () => {
    expect(rejectionOf({ name: "ada.pdf", type: "application/pdf", size: 6 * 1024 * 1024 })).toBe(TOO_LARGE_MESSAGE);
    expect(TOO_LARGE_MESSAGE).toBe("That PDF is over 5 MB. Compress it or remove heavy images.");
  });
});
