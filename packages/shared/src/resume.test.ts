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
    ["a rebuild without a job description", without(rebuiltResume, "jobDescriptionId")],
    ["a rebuild with empty content", { ...rebuiltResume, content: "" }],
    ["a rebuild carrying upload fields", { ...rebuiltResume, source: "upload" }],
  ])("rejects %s", (_label, input) => {
    expect(ResumeSchema.safeParse(input).success).toBe(false);
  });
});
