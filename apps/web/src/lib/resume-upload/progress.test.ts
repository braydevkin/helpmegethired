import type { UploadedResume } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { failureLeadOf, foundCountOf, percentageOf, pollDelayMs, profileDataRowsOf, stagesOf, type UploadView } from "./progress";

const resume = (overrides: Partial<UploadedResume>): UploadedResume => ({
  id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  accountId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  createdAt: "2026-09-08T10:00:00.000Z",
  source: "upload",
  fileName: "ada.pdf",
  contentType: "application/pdf",
  sizeBytes: 1024,
  sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  status: "uploaded",
  errorCode: null,
  finishedAt: null,
  progress: null,
  ...overrides,
});

const tracked = (overrides: Partial<UploadedResume>): UploadView => ({ phase: "tracked", resume: resume(overrides) });
const progress = (percentage: number, savedKinds: string[]) => ({
  ingestionId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  status: "running" as const,
  percentage,
  segments: { total: 8, saved: savedKinds.length, savedKinds },
});

describe("percentageOf", () => {
  it("fills the first quarter with the bytes sent", () => {
    expect(percentageOf({ phase: "uploading", bytesSent: 0, bytesTotal: 100 })).toBe(0);
    expect(percentageOf({ phase: "uploading", bytesSent: 50, bytesTotal: 100 })).toBe(12);
    expect(percentageOf({ phase: "uploading", bytesSent: 100, bytesTotal: 100 })).toBe(25);
  });

  it("reads 25 once uploaded, 30 while processing without an Ingestion, and maps the Progress onto 30 to 100", () => {
    expect(percentageOf(tracked({ status: "uploaded" }))).toBe(25);
    expect(percentageOf(tracked({ status: "processing" }))).toBe(30);
    expect(percentageOf(tracked({ status: "processing", progress: progress(0, []) }))).toBe(30);
    expect(percentageOf(tracked({ status: "processing", progress: progress(50, ["header"]) }))).toBe(65);
    expect(percentageOf(tracked({ status: "done", progress: progress(100, ["header"]) }))).toBe(100);
  });

  it("keeps the percentage a failed record reached", () => {
    expect(percentageOf(tracked({ status: "failed", errorCode: "not_pdf" }))).toBe(30);
    expect(percentageOf(tracked({ status: "failed", errorCode: "profile_build_failed", progress: progress(40, ["header"]) }))).toBe(58);
  });
});

describe("stagesOf", () => {
  const states = (view: UploadView) => stagesOf(view).map((stage) => `${stage.state}:${stage.detail}`);

  it("runs the five stages in order", () => {
    expect(states({ phase: "uploading", bytesSent: 1, bytesTotal: 2 })[0]).toBe("active:Direct, presigned transfer to object storage.");
    expect(states(tracked({ status: "uploaded" }))).toEqual([
      "done:Done",
      "active:Job registered and picked up by a worker.",
      "waiting:Waiting",
      "waiting:Waiting",
      "waiting:Waiting",
    ]);
    expect(states(tracked({ status: "processing" }))[2]).toBe("active:Parsing sections, dates and contact details.");
    expect(states(tracked({ status: "processing", progress: progress(10, []) }))[3]).toBe("active:Mapping experience, skills and languages.");
    expect(states(tracked({ status: "done" }))).toEqual(["done:Done", "done:Done", "done:Done", "done:Done", "done:Done"]);
  });

  it("marks the stage that was running when the record failed", () => {
    expect(states(tracked({ status: "failed", errorCode: "not_pdf" }))[2]).toBe("failed:Parsing sections, dates and contact details.");
    expect(states(tracked({ status: "failed", errorCode: "profile_build_failed", progress: progress(40, []) }))[3]).toMatch(/^failed:/);
  });
});

describe("profileDataRowsOf", () => {
  it("lists the eleven parts and ticks each as its Segment is saved", () => {
    const rows = profileDataRowsOf(tracked({ status: "processing", progress: progress(40, ["header", "experience", "experience"]) }));

    expect(rows.map((row) => row.label)).toEqual([
      "Headline",
      "Summary",
      "GitHub profile",
      "LinkedIn profile",
      "Years of experience",
      "Experience",
      "Education",
      "Skills",
      "Projects",
      "Certifications",
      "Languages",
    ]);
    expect(rows.slice(0, 6).map((row) => row.value)).toEqual(["Found", "Found", "Found", "Found", "Found", "2 roles"]);
    expect(rows.slice(6).every((row) => row.value === undefined)).toBe(true);
    expect(foundCountOf(rows)).toEqual({ found: 6, total: 11 });
  });

  it("shows every row found once the record is done", () => {
    const rows = profileDataRowsOf(tracked({ status: "done", progress: progress(100, ["header", "skills"]) }));

    expect(foundCountOf(rows)).toEqual({ found: 11, total: 11 });
    expect(rows.find((row) => row.label === "Projects")?.value).toBe("1 found");
  });
});

describe("failureLeadOf", () => {
  it("has the designed lead for every code and falls back to the reading failure", () => {
    expect(failureLeadOf("scanned_pdf")).toContain("scan or an image");
    expect(failureLeadOf("too_many_pages")).toContain("more than 20 pages");
    expect(failureLeadOf(null)).toContain("after several tries");
  });
});

describe("pollDelayMs", () => {
  it("doubles from one second and caps at ten", () => {
    expect([0, 1, 2, 3, 4, 9].map(pollDelayMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });
});
