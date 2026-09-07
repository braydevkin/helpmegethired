import { describe, expect, it } from "vitest";

import { uploadedResume, without } from "./candidate.fixtures.js";
import { ResumeUploadReceiptSchema, UploadedResumeListQuerySchema, UploadedResumeListSchema } from "./resume-routes.js";

const upload = {
  url: "http://localhost:9000/resumes/resumes/account/upload.pdf?X-Amz-Signature=abc",
  method: "PUT",
  headers: { "content-type": "application/pdf", "content-length": "184320", "x-amz-checksum-sha256": "n4bQgY" },
  expiresAt: "2026-09-02T10:06:00.000Z",
};

describe("ResumeUploadReceiptSchema", () => {
  it("accepts a pending record with the upload to perform", () => {
    expect(ResumeUploadReceiptSchema.safeParse({ resume: uploadedResume, upload }).success).toBe(true);
  });

  it("accepts an existing record with no upload to perform", () => {
    const existing = { resume: { ...uploadedResume, status: "done" }, upload: null };

    expect(ResumeUploadReceiptSchema.safeParse(existing).success).toBe(true);
  });

  it.each([
    ["an upload with another method", { resume: uploadedResume, upload: { ...upload, method: "POST" } }],
    ["an upload without its headers", { resume: uploadedResume, upload: without(upload, "headers") }],
    ["a receipt without the record", { upload }],
  ])("rejects %s", (_label, input) => {
    expect(ResumeUploadReceiptSchema.safeParse(input).success).toBe(false);
  });
});

describe("UploadedResumeListQuerySchema", () => {
  it("accepts no filter and a known status", () => {
    expect(UploadedResumeListQuerySchema.parse({})).toEqual({});
    expect(UploadedResumeListQuerySchema.parse({ status: "done" })).toEqual({ status: "done" });
  });

  it("rejects an unknown status", () => {
    expect(UploadedResumeListQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});

describe("UploadedResumeListSchema", () => {
  it("accepts an empty list and a list of records", () => {
    expect(UploadedResumeListSchema.safeParse([]).success).toBe(true);
    expect(UploadedResumeListSchema.safeParse([uploadedResume]).success).toBe(true);
  });
});
