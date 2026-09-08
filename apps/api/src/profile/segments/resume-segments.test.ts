import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cleanedLinesOf, resumeSegmentsOf, type ResumeSegment } from "./resume-segments";

const corpus = join(__dirname, "../../../test/fixtures/resumes/corpus");
const fixture = (slug: string) => readFileSync(join(corpus, `${slug}.txt`), "utf8");
const UPLOADED_RESUME_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";

const textOf = (segment: ResumeSegment, lines: readonly string[]): string[] => [
  ...segment.input.ranges.flatMap((range) => lines.slice(range.start, range.end)),
  ...segment.input.paragraphs.map((range) => lines.slice(range.start, range.end).join(" ")),
];

describe("resumeSegmentsOf", () => {
  it("makes one Segment per Profile part in order, one per Experience and Project block, from a single-column resume", () => {
    const text = fixture("ada-single-column-en");
    const segments = resumeSegmentsOf(text, UPLOADED_RESUME_ID);
    const lines = cleanedLinesOf(text);

    expect(segments.map((segment) => segment.kind)).toEqual([
      "header",
      "experience",
      "experience",
      "education",
      "project",
      "skills",
      "languages",
      "certifications",
    ]);
    expect(segments.every((segment) => segment.input.uploadedResumeId === UPLOADED_RESUME_ID)).toBe(true);
    expect(textOf(segments[0]!, lines)).toEqual([
      "Ada Lovelace",
      "Senior Backend Engineer",
      "London, United Kingdom | +44 20 7946 0958 | ada.lovelace@example.com",
      "linkedin.com/in/ada-lovelace-example · github.com/ada-example",
      "",
      "SUMMARY",
      "",
      "Backend engineer with ten years building queues, ingestion pipelines, and the services",
      "around them. Comfortable owning a system from the schema to the on-call rota.",
      "",
    ]);
    expect(textOf(segments[1]!, lines)[0]).toBe("Senior Backend Engineer | Analytical Engines Ltd");
    expect(textOf(segments[2]!, lines)[0]).toBe("Backend Engineer | Difference Works");
    expect(textOf(segments[3]!, lines)).toEqual(["MSc in Computer Science, University of Cambridge", "2014 – 2016", "", "BSc in Mathematics, University of Leeds", "2011 – 2014"]);
    expect(textOf(segments[4]!, lines)[0]).toBe("Difference Engine — https://github.com/ada-example/difference-engine");
    expect(segments[5]!.input.ranges).toEqual([{ start: 0, end: lines.length }]);
    expect(textOf(segments[6]!, lines)).toEqual(["English - Native", "French - Intermediate (B1)"]);
    expect(textOf(segments[7]!, lines)).toEqual(["AWS Solutions Architect Associate — Amazon Web Services, 2023"]);
  });

  it("gives a labelled paragraph found in another section to the Segment of its kind, as one line", () => {
    const text = fixture("zeno-latex-like-en");
    const segments = resumeSegmentsOf(text, UPLOADED_RESUME_ID);
    const lines = cleanedLinesOf(text);
    const certifications = segments.find((segment) => segment.kind === "certifications");

    expect(segments.map((segment) => segment.kind)).toEqual(["header", "experience", "experience", "education", "skills", "languages", "certifications"]);
    expect(certifications?.input.ranges).toEqual([]);
    expect(textOf(certifications!, lines)).toEqual([
      "Certifications: Offensive Security Certified Professional (OffSec, 2019); CISSP (ISC2, 2022)",
    ]);
  });

  it("leaves out the parts the resume lacks and always reads the skills over the whole text", () => {
    const segments = resumeSegmentsOf("Ada Lovelace\nBackend engineer working with Python.\n", UPLOADED_RESUME_ID);

    expect(segments.map((segment) => segment.kind)).toEqual(["header", "skills"]);
  });

  it("produces no Segment for an empty text", () => {
    expect(resumeSegmentsOf("", UPLOADED_RESUME_ID)).toEqual([]);
  });
});
