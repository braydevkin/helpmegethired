import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RESUME_SEGMENT_KINDS, cleanedLinesOf, resumeSegmentsOf } from "./resume-segments";

const corpus = join(__dirname, "../../../test/fixtures/resumes/corpus");
const fixture = (slug: string) => readFileSync(join(corpus, `${slug}.txt`), "utf8");
const UPLOADED_RESUME_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";

describe("resumeSegmentsOf", () => {
  it("makes one Segment per Profile part, in the order the parts are built, each over the whole text", () => {
    const text = fixture("ada-single-column-en");
    const segments = resumeSegmentsOf(text, UPLOADED_RESUME_ID);

    expect(segments.map((segment) => segment.kind)).toEqual([...RESUME_SEGMENT_KINDS]);
    expect(segments.map((segment) => segment.kind)).toEqual(["header", "experience", "education", "project", "skills", "languages", "certifications"]);
    for (const segment of segments) {
      expect(segment.input).toEqual({ uploadedResumeId: UPLOADED_RESUME_ID, ranges: [{ start: 0, end: cleanedLinesOf(text).length }] });
    }
  });

  it("makes every part's Segment even when the resume has no section for it", () => {
    const segments = resumeSegmentsOf("Ada Lovelace\nBackend engineer working with Python.\n", UPLOADED_RESUME_ID);

    expect(segments.map((segment) => segment.kind)).toEqual([...RESUME_SEGMENT_KINDS]);
  });

  it.each(["", "\n\n   \n"])("produces no Segment for a text with no words: %j", (text) => {
    expect(resumeSegmentsOf(text, UPLOADED_RESUME_ID)).toEqual([]);
  });
});
