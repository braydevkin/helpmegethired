import { describe, expect, it } from "vitest";

import {
  RESUME_MAX_PAGES,
  RESUME_MAX_SIZE_BYTES,
  ResumeUploadErrorCodeSchema,
  ResumeUploadSchema,
} from "./resume-upload.js";

const resumeUpload = {
  fileName: "ada-lovelace.pdf",
  sizeBytes: 184_320,
  sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
};

describe("ResumeUploadSchema", () => {
  it("accepts a PDF within the limits", () => {
    expect(ResumeUploadSchema.safeParse(resumeUpload).success).toBe(true);
  });

  it("accepts a file exactly at the size limit and an upper-case extension", () => {
    const input = { ...resumeUpload, fileName: "CV.PDF", sizeBytes: RESUME_MAX_SIZE_BYTES };

    expect(ResumeUploadSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    ["a name without the .pdf extension", { ...resumeUpload, fileName: "ada-lovelace.docx" }],
    ["an empty name", { ...resumeUpload, fileName: "  " }],
    ["a file one byte over the limit", { ...resumeUpload, sizeBytes: RESUME_MAX_SIZE_BYTES + 1 }],
    ["an empty file", { ...resumeUpload, sizeBytes: 0 }],
    ["a fractional size", { ...resumeUpload, sizeBytes: 12.5 }],
    ["a short checksum", { ...resumeUpload, sha256: "9f86d081" }],
  ])("rejects %s", (_label, input) => {
    expect(ResumeUploadSchema.safeParse(input).success).toBe(false);
  });

  it("lowercases an upper-case checksum so the same bytes always dedupe to one record", () => {
    const parsed = ResumeUploadSchema.parse({ ...resumeUpload, sha256: resumeUpload.sha256.toUpperCase() });

    expect(parsed.sha256).toBe(resumeUpload.sha256);
  });

  it("fixes the limits the design pages quote", () => {
    expect(RESUME_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(RESUME_MAX_PAGES).toBe(20);
  });
});

describe("ResumeUploadErrorCodeSchema", () => {
  it("names every failure the upload page has a message for", () => {
    expect(ResumeUploadErrorCodeSchema.options).toEqual([
      "not_pdf",
      "too_large",
      "too_many_pages",
      "encrypted_pdf",
      "corrupt_pdf",
      "scanned_pdf",
      "upload_incomplete",
      "extraction_failed",
      "profile_build_failed",
      "ingestion_active",
    ]);
  });

  it("rejects a code the page cannot show", () => {
    expect(ResumeUploadErrorCodeSchema.safeParse("virus_found").success).toBe(false);
  });
});
