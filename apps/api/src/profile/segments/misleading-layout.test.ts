import type { SegmentRecognition } from "@helpmegethired/shared";
import { describe, expect, it, vi } from "vitest";

import type { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import type { ModelChoiceService } from "../../model-choice/model-choice.service";
import { ModelKey } from "../../model-choice/model-key";
import { certificationsOf, educationOf, experiencesOf, languagesOf, projectsOf, splitSections } from "../../parser";
import type { RecognitionModel } from "../../recognition/recognition-model";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import type { ProfileRepository } from "../profile.repository";
import { CertificationsSegmentProcessor } from "./certifications.processor";
import { EducationSegmentProcessor } from "./education.processor";
import { ExperienceSegmentProcessor } from "./experience.processor";
import { LanguagesSegmentProcessor } from "./languages.processor";
import { ProjectSegmentProcessor } from "./project.processor";

const CONTEXT: SegmentContext = {
  ingestionId: "6a0c2e4f-8b1d-4f3a-9c5e-7d2b4f6a8c0e",
  accountId: "2b4d6f8a-0c2e-4a6c-8e0a-2c4e6a8c0e2a",
  segmentId: "9e7c5a3b-1d0f-4e2c-8a6b-4d2f0e8c6a4b",
  position: 1,
};

// A fictional résumé laid out the way that misled the rules: a wrapped bullet that reads like a
// job heading, a sub-heading inside a job that reads like the projects heading, a later job below
// it, a certification under the education heading, and a `Languages:` line among the skills.
const RESUME = [
  "Marina Okafor",
  "Senior Software Engineer",
  "Lisbon, Portugal | marina.okafor@example.com",
  "",
  "EXPERIENCE",
  "",
  "Senior Software Engineer | Tidewater Logistics",
  "Mar 2021 – Present",
  "Led the migration of the dispatch platform to event sourcing, pairing with the operations team on code and",
  "developer review, cutting delivery time by at least 30%",
  "Built the routing service in TypeScript on PostgreSQL.",
  "Selected projects",
  "Community freight exchange for a nonprofit, five engineers led as tech lead",
  "Designed the matching engine in Go.",
  "",
  "Full Stack Developer | Brightfold Studio",
  "Jan 2018 – Feb 2021",
  "Shipped the booking app in React and Node.js.",
  "",
  "EDUCATION",
  "",
  "BSc in Computer Science, University of Porto",
  "2014 – 2017",
  "AWS Certified Developer – Associate, Amazon Web Services, 2022",
  "",
  "SKILLS",
  "",
  "Languages: TypeScript, Go, Python, SQL",
  "Frameworks: React, Node.js",
  "",
  "LANGUAGES",
  "English - Fluent",
  "Portuguese - Native",
];

const quoted = (text: string) => ({ value: text, quote: text });

const TIDEWATER_DESCRIPTION = [
  "Led the migration of the dispatch platform to event sourcing, pairing with the operations team on code and",
  "developer review, cutting delivery time by at least 30%",
  "Built the routing service in TypeScript on PostgreSQL.",
  "Selected projects",
  "Community freight exchange for a nonprofit, five engineers led as tech lead",
  "Designed the matching engine in Go.",
].join("\n");

const experiencesByModel: SegmentRecognition<"experience"> = {
  experiences: [
    {
      role: quoted("Senior Software Engineer"),
      company: quoted("Tidewater Logistics"),
      period: { start: "2021-03", end: null, quote: "Mar 2021 – Present" },
      description: quoted(TIDEWATER_DESCRIPTION),
      skills: [quoted("TypeScript"), quoted("PostgreSQL"), quoted("Go")],
    },
    {
      role: quoted("Full Stack Developer"),
      company: quoted("Brightfold Studio"),
      period: { start: "2018-01", end: "2021-02", quote: "Jan 2018 – Feb 2021" },
      description: quoted("Shipped the booking app in React and Node.js."),
      skills: [quoted("React"), quoted("Node.js")],
    },
  ],
};

const resumes = {} as UploadedResumeRunRepository;
const profiles = {} as ProfileRepository;

const readerAnswering = (output: unknown): SegmentModelReader =>
  new SegmentModelReader(
    { usableModelKey: () => Promise.resolve({ provider: "anthropic", modelId: "claude-sonnet-5", key: new ModelKey("sk-ant-candidate") }) } as unknown as ModelChoiceService,
    { recognize: vi.fn(() => Promise.resolve({ output, usage: { inputTokens: 10, outputTokens: 5 } })) } as unknown as RecognitionModel,
  );

describe("a résumé whose layout misleads the rules", () => {
  const sections = splitSections(RESUME);

  it("misleads the rules on their own", () => {
    expect(experiencesOf(sections).map((experience) => [experience.role.value, experience.company?.value])).toEqual([
      ["Senior Software Engineer", "Tidewater Logistics"],
      ["developer review", "cutting delivery time by"],
    ]);
    expect(projectsOf(sections).map((project) => project.name.value)).toContain("Full Stack Developer");
    expect(educationOf(sections).map((entry) => entry.institution.value)).toEqual(["University of Porto AWS Certified Developer"]);
    expect(certificationsOf(sections)).toEqual([]);
    expect(languagesOf(sections).map((language) => language.name.value)).toContain("TypeScript");
  });

  it("keeps the positions the Model read, each with its own role, company, period, and whole description", async () => {
    const { experiences } = await new ExperienceSegmentProcessor(resumes, readerAnswering(experiencesByModel), profiles).recognize({ lines: RESUME }, CONTEXT);

    expect(experiences.map((experience) => [experience.role.value, experience.company?.value, experience.period?.value, experience.description?.value])).toEqual([
      ["Senior Software Engineer", "Tidewater Logistics", { start: "2021-03", end: null }, TIDEWATER_DESCRIPTION],
      ["Full Stack Developer", "Brightfold Studio", { start: "2018-01", end: "2021-02" }, "Shipped the booking app in React and Node.js."],
    ]);
  });

  it("saves no project when the Model read the sub-heading and the later job as parts of the positions", async () => {
    const recognized = await new ProjectSegmentProcessor(resumes, readerAnswering({ projects: [] }), profiles).recognize({ lines: RESUME }, CONTEXT);

    expect(recognized).toEqual({ projects: [] });
  });

  it("moves the certification written under the education heading out of the education", async () => {
    const education = await new EducationSegmentProcessor(
      resumes,
      readerAnswering({
        education: [
          {
            institution: quoted("University of Porto"),
            degree: quoted("BSc"),
            fieldOfStudy: quoted("Computer Science"),
            period: { start: "2014-01", end: "2017-12", quote: "2014 – 2017" },
          },
        ],
      }),
      profiles,
    ).recognize({ lines: RESUME }, CONTEXT);
    const certifications = await new CertificationsSegmentProcessor(
      resumes,
      readerAnswering({
        certifications: [{ name: quoted("AWS Certified Developer – Associate"), issuer: quoted("Amazon Web Services"), year: { value: 2022, quote: "2022" } }],
      }),
      profiles,
    ).recognize({ lines: RESUME }, CONTEXT);

    expect(education.education.map((entry) => [entry.institution.value, entry.degree?.value, entry.fieldOfStudy?.value])).toEqual([["University of Porto", "BSc", "Computer Science"]]);
    expect(certifications.certifications.map((entry) => [entry.name.value, entry.issuer?.value, entry.year?.value])).toEqual([
      ["AWS Certified Developer – Associate", "Amazon Web Services", 2022],
    ]);
  });

  it("saves only the spoken languages, never the technologies listed under a `Languages:` label", async () => {
    const { languages } = await new LanguagesSegmentProcessor(
      resumes,
      readerAnswering({
        languages: [
          { name: quoted("English"), level: quoted("Fluent") },
          { name: quoted("Portuguese"), level: quoted("Native") },
        ],
      }),
      profiles,
    ).recognize({ lines: RESUME }, CONTEXT);

    expect(languages.map((language) => [language.name.value, language.level?.value])).toEqual([
      ["English", "Fluent"],
      ["Portuguese", "Native"],
    ]);
  });
});
