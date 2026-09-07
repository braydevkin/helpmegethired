import type { UploadedResume } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { etagOf } from "./resume-etag";

const uploadedResume: UploadedResume = {
  id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  accountId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  createdAt: "2026-09-02T10:01:00.000Z",
  source: "upload",
  fileName: "ada-lovelace.pdf",
  contentType: "application/pdf",
  sizeBytes: 184_320,
  sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  status: "pending",
  errorCode: null,
  finishedAt: null,
  progress: null,
};

describe("etagOf", () => {
  const progress = { ingestionId: "0f8fad5b-d9cb-469f-a165-70867728950e", status: "running" as const, percentage: 44, segments: { total: 3, saved: 1 } };

  it("is a quoted opaque tag that stays the same for the same state", () => {
    expect(etagOf(uploadedResume)).toMatch(/^"[0-9a-f]{40}"$/);
    expect(etagOf({ ...uploadedResume })).toBe(etagOf(uploadedResume));
  });

  it.each([
    ["the status", { ...uploadedResume, status: "uploaded" as const }],
    ["the error code", { ...uploadedResume, status: "failed" as const, errorCode: "scanned_pdf" as const }],
    ["the Progress", { ...uploadedResume, status: "processing" as const, progress }],
    ["a Step of the Progress", { ...uploadedResume, status: "processing" as const, progress: { ...progress, percentage: 55 } }],
  ])("changes with %s", (_label, changed) => {
    expect(etagOf(changed)).not.toBe(etagOf(uploadedResume));
  });

  it("ignores what the page does not render, such as the file name", () => {
    expect(etagOf({ ...uploadedResume, fileName: "renamed.pdf" })).toBe(etagOf(uploadedResume));
  });
});
