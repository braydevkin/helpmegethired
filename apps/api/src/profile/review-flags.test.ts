import { describe, expect, it } from "vitest";

import type { Segment } from "../ingestion/segment";
import { reviewFlagsOf } from "./review-flags";

const segment = (kind: string, recognized: unknown, status: Segment["status"] = "saved"): Segment => ({
  id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b",
  ingestionId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  position: 0,
  kind,
  status,
  input: {},
  content: null,
  recognized,
  lastError: null,
});

const field = <Value>(value: Value, confidence: "high" | "medium" | "low") => ({ value, confidence });

describe("reviewFlagsOf", () => {
  it("names every low-confidence field with its part and entry", () => {
    const flags = reviewFlagsOf([
      segment("experience", {
        experiences: [
          { role: field("Acme", "low"), company: field("Globex", "low"), period: null, description: null, skills: [] },
          { role: field("Engineer", "high"), company: field("Acme", "high"), period: field({ start: "2020-01", end: null }, "high"), description: null, skills: [] },
        ],
      }),
      segment("education", {
        education: [{ institution: field("Lisboa", "low"), degree: field("Engenharia", "low"), fieldOfStudy: null, period: null }],
      }),
    ]);

    expect(flags).toEqual([
      { part: "experience", entry: "Acme", field: "company", reason: "low_confidence" },
      { part: "experience", entry: "Acme", field: "role", reason: "low_confidence" },
      { part: "education", entry: "Lisboa", field: "institution", reason: "low_confidence" },
      { part: "education", entry: "Lisboa", field: "degree", reason: "low_confidence" },
    ]);
  });

  it("flags the header's summary and an Account mismatch without any entry", () => {
    const flags = reviewFlagsOf([
      segment("header", {
        basicProfile: { headline: field("Engineer", "medium"), summary: field("Free lines", "low"), linkedinUrl: null, githubUrl: null },
        accountMismatch: { name: true, email: false },
      }),
    ]);

    expect(flags).toEqual([
      { part: "basicProfile", entry: null, field: "summary", reason: "low_confidence" },
      { part: "basicProfile", entry: null, field: "name", reason: "account_mismatch" },
    ]);
  });

  it("ignores medium and high fields, unsaved Segments, unknown kinds, and output it cannot read", () => {
    const flags = reviewFlagsOf([
      segment("languages", { languages: [{ name: field("English", "medium"), level: field("Native", "medium") }] }),
      segment("experience", { experiences: [{ role: field("Acme", "low"), company: null, period: null, description: null, skills: [] }] }, "recognized"),
      segment("linkedin-header", { anything: true }),
      segment("project", { projects: "not a list" }),
    ]);

    expect(flags).toEqual([]);
  });
});
