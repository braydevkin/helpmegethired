import { describe, expect, it } from "vitest";

import { rebuiltResume, uploadedResume, without } from "./candidate.fixtures.js";
import { RebuiltResumeSchema, ResumeSchema, UploadedResumeSchema } from "./resume.js";

describe("ResumeSchema", () => {
  it("accepts an uploaded PDF resume", () => {
    expect(ResumeSchema.safeParse(uploadedResume).success).toBe(true);
    expect(UploadedResumeSchema.safeParse(uploadedResume).success).toBe(true);
  });

  it("accepts a resume rebuilt for one job description", () => {
    expect(ResumeSchema.safeParse(rebuiltResume).success).toBe(true);
    expect(RebuiltResumeSchema.safeParse(rebuiltResume).success).toBe(true);
  });

  it("accepts a processing upload carrying the Progress of its Ingestion", () => {
    const processing = {
      ...uploadedResume,
      status: "processing",
      progress: { ingestionId: "0f8fad5b-d9cb-469f-a165-70867728950e", status: "running", percentage: 44, segments: { total: 3, saved: 1 } },
    };

    expect(UploadedResumeSchema.safeParse(processing).success).toBe(true);
  });

  it("accepts a failed upload carrying its error code and finish time", () => {
    const failed = { ...uploadedResume, status: "failed", errorCode: "scanned_pdf", finishedAt: "2026-09-02T10:02:00.000Z" };

    expect(UploadedResumeSchema.safeParse(failed).success).toBe(true);
  });

  it("narrows on the source discriminator", () => {
    const parsed = ResumeSchema.parse(rebuiltResume);
    if (parsed.source !== "rebuild") {
      throw new Error("expected a rebuilt resume");
    }
    expect(parsed.jobDescriptionId).toBe(rebuiltResume.jobDescriptionId);
  });

  it.each([
    ["an unknown source", { ...uploadedResume, source: "linkedin" }],
    ["an upload that is not a PDF", { ...uploadedResume, contentType: "application/msword" }],
    ["an upload with zero bytes", { ...uploadedResume, sizeBytes: 0 }],
    ["an upload with a fractional size", { ...uploadedResume, sizeBytes: 12.5 }],
    ["an upload with an unknown status", { ...uploadedResume, status: "scanning" }],
    ["an upload with an error code the page cannot show", { ...uploadedResume, errorCode: "virus_found" }],
    ["an upload without its checksum", without(uploadedResume, "sha256")],
    ["an upload whose progress lacks the segments", { ...uploadedResume, progress: { ingestionId: uploadedResume.id, status: "running", percentage: 40 } }],
    ["a rebuild without a job description", without(rebuiltResume, "jobDescriptionId")],
    ["a rebuild with empty content", { ...rebuiltResume, content: "" }],
    ["a rebuild carrying upload fields", { ...rebuiltResume, source: "upload" }],
  ])("rejects %s", (_label, input) => {
    expect(ResumeSchema.safeParse(input).success).toBe(false);
  });
});
