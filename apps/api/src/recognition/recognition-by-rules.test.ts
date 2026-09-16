import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SEGMENT_RECOGNITION_SCHEMAS } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { cleanedLinesOf, resumeSegmentsOf } from "../profile/segments/resume-segments";
import { recognitionByRules } from "./recognition-by-rules";

const UPLOADED_RESUME_ID = "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b";
const corpus = join(__dirname, "../../test/fixtures/resumes/corpus");

const quotesIn = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(quotesIn);
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => (key === "quote" && typeof item === "string" ? [item] : quotesIn(item)));
};

// The lines each Segment's read Step hands over: its ranges line by line, its paragraphs joined.
function segmentsOfResume(text: string) {
  const lines = cleanedLinesOf(text);
  const slice = (range: { start: number; end: number }) => lines.slice(range.start, range.end);

  return resumeSegmentsOf(text, UPLOADED_RESUME_ID).map(({ kind, input }) => ({
    kind,
    lines: [...input.ranges.flatMap(slice), ...input.paragraphs.map((range) => slice(range).join(" "))],
  }));
}

describe("recognitionByRules", () => {
  it("answers a position with every value quoted from its lines", () => {
    const lines = [
      "Senior Backend Engineer | Analytical Engines Ltd",
      "London · Mar 2021 – Present",
      "Own the ingestion platform, written in TypeScript on PostgreSQL.",
      "Mentor four engineers.",
    ];

    expect(recognitionByRules("experience", lines)).toEqual({
      experiences: [
        {
          role: { value: "Senior Backend Engineer", quote: "Senior Backend Engineer" },
          company: { value: "Analytical Engines Ltd", quote: "Analytical Engines Ltd" },
          period: { start: "2021-03", end: null, quote: "Mar 2021 – Present" },
          description: {
            value: "Own the ingestion platform, written in TypeScript on PostgreSQL.\nMentor four engineers.",
            quote: "Own the ingestion platform, written in TypeScript on PostgreSQL.\nMentor four engineers.",
          },
          skills: [
            { value: "TypeScript", quote: "TypeScript" },
            { value: "PostgreSQL", quote: "PostgreSQL" },
          ],
        },
      ],
    });
  });

  it("answers the header's links in full, quoted as the Resume writes them", () => {
    const lines = ["Ada Lovelace", "Senior Backend Engineer", "linkedin.com/in/ada-example · github.com/ada-example", "", "SUMMARY", "Backend engineer with ten years", "building queues."];

    expect(recognitionByRules("header", lines)).toEqual({
      headline: { value: "Senior Backend Engineer", quote: "Senior Backend Engineer" },
      summary: { value: "Backend engineer with ten years building queues.", quote: "Backend engineer with ten years\nbuilding queues." },
      linkedinUrl: { value: "https://linkedin.com/in/ada-example", quote: "linkedin.com/in/ada-example" },
      githubUrl: { value: "https://github.com/ada-example", quote: "github.com/ada-example" },
    });
  });

  it("answers a certification's year as a number quoted as written", () => {
    expect(recognitionByRules("certifications", ["AWS Certified Solutions Architect — Amazon Web Services, 2023"])).toEqual({
      certifications: [
        {
          name: { value: "AWS Certified Solutions Architect", quote: "AWS Certified Solutions Architect" },
          issuer: { value: "Amazon Web Services", quote: "Amazon Web Services" },
          year: { value: 2023, quote: "2023" },
        },
      ],
    });
  });

  it("answers a technology by its name, quoted as the text spells it", () => {
    expect(recognitionByRules("skills", ["SKILLS", "golang, node.js"]).skills).toEqual([
      { name: { value: "Go", quote: "golang" }, category: "Languages & runtimes" },
      { name: { value: "Node.js", quote: "node.js" }, category: "Languages & runtimes" },
    ]);
  });

  it("answers nothing for a Segment with no lines", () => {
    expect(recognitionByRules("languages", [])).toEqual({ languages: [] });
  });

  const resumes = readdirSync(corpus)
    .filter((name) => name.endsWith(".txt"))
    .sort();

  it.each(resumes)("answers every Segment of %s with output that validates and quotes found in the Segment", (name) => {
    for (const { kind, lines } of segmentsOfResume(readFileSync(join(corpus, name), "utf8"))) {
      const output = recognitionByRules(kind, lines);
      const text = lines.join("\n");

      expect(SEGMENT_RECOGNITION_SCHEMAS[kind].parse(output)).toEqual(output);
      for (const quote of quotesIn(output)) {
        expect(text).toContain(quote);
      }
    }
  });
});
