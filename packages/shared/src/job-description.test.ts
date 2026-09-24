import { describe, expect, it } from "vitest";

import { JOB_DESCRIPTION_ID } from "./candidate.fixtures.js";
import { JOB_DESCRIPTION_MAX_CHARACTERS, JobDescriptionPasteSchema, JobDescriptionSchema } from "./job-description.js";

const text = "Senior Software Engineer. You have run a data ingestion platform in production.";

describe("JobDescriptionPasteSchema", () => {
  it("accepts a pasted Job Description and trims it", () => {
    expect(JobDescriptionPasteSchema.parse({ text: `  ${text}\n` })).toEqual({ text });
  });

  it("accepts text at the cap", () => {
    expect(JobDescriptionPasteSchema.safeParse({ text: "a".repeat(JOB_DESCRIPTION_MAX_CHARACTERS) }).success).toBe(true);
  });

  it.each([
    ["an empty paste", { text: "" }],
    ["whitespace only", { text: " \n\t " }],
    ["text over the cap", { text: "a".repeat(JOB_DESCRIPTION_MAX_CHARACTERS + 1) }],
    ["no text", {}],
    ["a number", { text: 42 }],
  ])("rejects %s", (_label, input) => {
    expect(JobDescriptionPasteSchema.safeParse(input).success).toBe(false);
  });
});

describe("JobDescriptionSchema", () => {
  const jobDescription = { id: JOB_DESCRIPTION_ID, text, createdAt: "2026-09-24T10:00:00.000Z" };

  it("accepts a kept Job Description", () => {
    expect(JobDescriptionSchema.safeParse(jobDescription).success).toBe(true);
  });

  it.each([
    ["one without an id", { ...jobDescription, id: undefined }],
    ["one with an empty text", { ...jobDescription, text: "" }],
    ["one without a creation time", { ...jobDescription, createdAt: null }],
  ])("rejects %s", (_label, input) => {
    expect(JobDescriptionSchema.safeParse(input).success).toBe(false);
  });
});
