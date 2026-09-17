import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SEGMENT_RECOGNITION_SCHEMAS, type SegmentRecognitionKind } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { certificationsOf, educationOf, experiencesOf, extractSkills, headerOf, languagesOf, projectsOf, splitSections } from "../parser";
import { cleanedLinesOf } from "../profile/segments/resume-segments";
import { recognitionByRules } from "./recognition-by-rules";
import { verifyCertifications, verifyEducation, verifyExperience, verifyHeader, verifyLanguages, verifyProject, verifySkills } from "./verification";

const corpus = join(__dirname, "../../test/fixtures/resumes/corpus");
const KINDS = Object.keys(SEGMENT_RECOGNITION_SCHEMAS) as SegmentRecognitionKind[];

const quotesIn = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(quotesIn);
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, item]) => (key === "quote" && typeof item === "string" ? [item] : quotesIn(item)));
};

const withoutConfidence = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (key, item: unknown) => (key === "confidence" ? undefined : item)));

describe("recognitionByRules", () => {
  it("answers a position with every value quoted from the resume", () => {
    const lines = [
      "EXPERIENCE",
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

  it("never answers a link written below the top of the resume as the Candidate's own", () => {
    const lines = ["Ada Lovelace", "Senior Backend Engineer", "", "PROJECTS", "", "Difference Engine — github.com/ada-example/difference-engine"];

    expect(recognitionByRules("header", lines).githubUrl).toBeNull();
  });

  it("answers a certification's year as a number quoted as written", () => {
    expect(recognitionByRules("certifications", ["CERTIFICATIONS", "AWS Certified Solutions Architect — Amazon Web Services, 2023"])).toEqual({
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

  it("answers nothing for a resume with no lines", () => {
    expect(recognitionByRules("languages", [])).toEqual({ languages: [] });
  });

  const resumes = readdirSync(corpus)
    .filter((name) => name.endsWith(".txt"))
    .sort();

  it.each(resumes)("answers every part of %s with output that validates and quotes found in the resume", (name) => {
    const lines = cleanedLinesOf(readFileSync(join(corpus, name), "utf8"));
    const text = lines.join("\n");

    for (const kind of KINDS) {
      const output = recognitionByRules(kind, lines);

      expect(SEGMENT_RECOGNITION_SCHEMAS[kind].parse(output)).toEqual(output);
      for (const quote of quotesIn(output)) {
        expect(text).toContain(quote);
      }
    }
  });

  // Without a Provider the fake answers what the rules read, so its verified reading must be the
  // rules' Profile: an entry lost or doubled here would change the Profile the local stack builds.
  it.each(resumes)("verifies into the entries the rules read from %s", (name) => {
    const lines = cleanedLinesOf(readFileSync(join(corpus, name), "utf8"));
    const sections = splitSections(lines);
    const header = { basicProfile: headerOf(lines).basicProfile, accountMismatch: { name: false, email: false } };
    const rules = {
      experiences: experiencesOf(sections),
      education: educationOf(sections),
      projects: projectsOf(sections),
      skills: extractSkills(sections),
      languages: languagesOf(sections),
      certifications: certificationsOf(sections),
    };
    const verified = {
      experiences: verifyExperience(lines, rules, recognitionByRules("experience", lines)).experiences,
      education: verifyEducation(lines, rules, recognitionByRules("education", lines)).education,
      projects: verifyProject(lines, rules, recognitionByRules("project", lines)).projects,
      skills: verifySkills(lines, rules, recognitionByRules("skills", lines)).skills,
      languages: verifyLanguages(lines, rules, recognitionByRules("languages", lines)).languages,
      certifications: verifyCertifications(lines, rules, recognitionByRules("certifications", lines)).certifications,
    };

    expect(withoutConfidence(verified)).toEqual(withoutConfidence(rules));
    expect(withoutConfidence(verifyHeader(lines, header, recognitionByRules("header", lines)))).toEqual(withoutConfidence(header));
  });
});
