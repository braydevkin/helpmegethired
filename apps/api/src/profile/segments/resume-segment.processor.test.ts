import type { Account, SegmentRecognition, SegmentRecognitionKind } from "@helpmegethired/shared";
import { describe, expect, it, vi } from "vitest";

import type { AccountRepository } from "../../auth/account.repository";
import { ProviderRateLimitedError } from "../../curation/model/curation-model-errors";
import type { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { ModelKeyNotFoundError } from "../../model-choice/model-choice-errors";
import type { ModelChoiceService } from "../../model-choice/model-choice.service";
import { ModelKey } from "../../model-choice/model-key";
import { extractExperiences, withSkills } from "../../parser";
import type { RecognitionModel } from "../../recognition/recognition-model";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import type { ProfileRepository } from "../profile.repository";
import { CertificationsSegmentProcessor } from "./certifications.processor";
import { EducationSegmentProcessor } from "./education.processor";
import { ExperienceSegmentProcessor } from "./experience.processor";
import { AccountMissingError, HeaderSegmentProcessor } from "./header.processor";
import { LanguagesSegmentProcessor } from "./languages.processor";
import { ProjectSegmentProcessor } from "./project.processor";
import type { ResumeSegmentContent } from "./resume-segment.processor";
import { SkillsSegmentProcessor } from "./skills.processor";

const CONTEXT: SegmentContext = {
  ingestionId: "0c9a8b7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d",
  accountId: "7d3f1c2a-9b8e-4c6d-a5f4-3e2d1c0b9a87",
  segmentId: "5b4a3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d",
  position: 1,
};

const EXPERIENCE: ResumeSegmentContent = {
  lines: ["Analytical Engines Ltd", "Senior Backend Engineer", "Mar 2021 – Present", "Own the ingestion platform."],
};

const resumes = {} as UploadedResumeRunRepository;
const profiles = {} as ProfileRepository;

interface Doubles {
  reader: SegmentModelReader;
  recognize: ReturnType<typeof vi.fn>;
  usableModelKey: ReturnType<typeof vi.fn>;
}

function doubles(output: unknown, keyStored = true): Doubles {
  const usableModelKey = vi.fn(() =>
    keyStored
      ? Promise.resolve({ provider: "anthropic", modelId: "claude-sonnet-5", key: new ModelKey("sk-ant-candidate") })
      : Promise.reject(new ModelKeyNotFoundError(CONTEXT.accountId)),
  );
  const recognize = vi.fn(() => Promise.resolve({ output, usage: { inputTokens: 10, outputTokens: 5 } }));
  const reader = new SegmentModelReader({ usableModelKey } as unknown as ModelChoiceService, { recognize } as unknown as RecognitionModel);

  return { reader, recognize, usableModelKey };
}

const experienceByModel: SegmentRecognition<"experience"> = {
  experiences: [
    {
      role: { value: "Senior Backend Engineer", quote: "Senior Backend Engineer" },
      company: { value: "Analytical Engines Ltd", quote: "Analytical Engines Ltd" },
      period: { start: "2021-03", end: null, quote: "Mar 2021 – Present" },
      description: null,
      skills: [],
    },
  ],
};

describe("ResumeSegmentProcessor.recognize", () => {
  it("answers the rules' reading unchanged and calls no Model when the Account holds no Model Key", async () => {
    const { reader, recognize } = doubles(experienceByModel, false);
    const processor = new ExperienceSegmentProcessor(resumes, reader, profiles);

    await expect(processor.recognize(EXPERIENCE, CONTEXT)).resolves.toEqual({ experiences: extractExperiences(EXPERIENCE.lines).map(withSkills) });
    expect(recognize).not.toHaveBeenCalled();
  });

  it("sends the Segment's lines to the Account's Model and answers the rules' verification of its reading", async () => {
    const { reader, recognize, usableModelKey } = doubles(experienceByModel);
    const processor = new ExperienceSegmentProcessor(resumes, reader, profiles);

    const recognized = await processor.recognize(EXPERIENCE, CONTEXT);

    expect(usableModelKey).toHaveBeenCalledWith(CONTEXT.accountId);
    expect(recognize).toHaveBeenCalledWith(expect.objectContaining({ kind: "experience", lines: EXPERIENCE.lines, modelId: "claude-sonnet-5" }));
    expect(recognized.experiences).toEqual([
      {
        role: { value: "Senior Backend Engineer", confidence: "high" },
        company: { value: "Analytical Engines Ltd", confidence: "high" },
        period: { value: { start: "2021-03", end: null }, confidence: "high" },
        description: { value: "Own the ingestion platform.", confidence: "high" },
        skills: [],
      },
    ]);
  });

  it("throws what the Model throws, so the Ingestion's attempt fails and is retried", async () => {
    const { reader, recognize } = doubles(experienceByModel);
    const processor = new ExperienceSegmentProcessor(resumes, reader, profiles);

    recognize.mockImplementation(() => Promise.reject(new ProviderRateLimitedError(30)));

    await expect(processor.recognize(EXPERIENCE, CONTEXT)).rejects.toBeInstanceOf(ProviderRateLimitedError);
  });

  it("offers the Model only the lines the kind's rules read, never another kind's labelled paragraph", async () => {
    const { reader, recognize } = doubles({ languages: [] });
    const processor = new LanguagesSegmentProcessor(resumes, reader, profiles);

    await processor.recognize({ lines: ["Languages: English - Native", "Certifications: AWS Solutions Architect, 2023"] }, CONTEXT);

    expect(recognize).toHaveBeenCalledWith(expect.objectContaining({ lines: ["English - Native"] }));
  });

  it("checks the Account before any Model call on the header", async () => {
    const { reader, recognize, usableModelKey } = doubles({ headline: null, summary: null, linkedinUrl: null, githubUrl: null });
    const accounts = { findById: () => Promise.resolve(undefined) } as unknown as AccountRepository;
    const processor = new HeaderSegmentProcessor(resumes, reader, accounts, profiles);

    await expect(processor.recognize({ lines: ["Ada Lovelace"] }, CONTEXT)).rejects.toBeInstanceOf(AccountMissingError);
    expect(usableModelKey).not.toHaveBeenCalled();
    expect(recognize).not.toHaveBeenCalled();
  });

  it("keeps the header's Account comparison from the rules while the Model verifies the Basic Profile", async () => {
    const account = { id: CONTEXT.accountId, email: "someone@example.com", name: "Ada", lastName: "Lovelace" } as Account;
    const accounts = { findById: () => Promise.resolve(account) } as unknown as AccountRepository;
    const { reader } = doubles({
      headline: { value: "Senior Backend Engineer", quote: "Senior Backend Engineer" },
      summary: null,
      linkedinUrl: null,
      githubUrl: { value: "https://github.com/ada-example", quote: "github.com/ada-example" },
    });
    const processor = new HeaderSegmentProcessor(resumes, reader, accounts, profiles);

    const recognized = await processor.recognize({ lines: ["Ada Lovelace", "Senior Backend Engineer", "ada.lovelace@example.com · github.com/ada-example"] }, CONTEXT);

    expect(recognized.accountMismatch).toEqual({ name: false, email: true });
    expect(recognized.basicProfile.headline).toEqual({ value: "Senior Backend Engineer", confidence: "high" });
    expect(recognized.basicProfile.githubUrl).toEqual({ value: "https://github.com/ada-example", confidence: "high" });
  });

  it.each<[SegmentRecognitionKind, (reader: SegmentModelReader) => { recognize: (content: ResumeSegmentContent, context: SegmentContext) => Promise<unknown> }, unknown]>([
    ["experience", (reader) => new ExperienceSegmentProcessor(resumes, reader, profiles), { experiences: [] }],
    ["education", (reader) => new EducationSegmentProcessor(resumes, reader, profiles), { education: [] }],
    ["project", (reader) => new ProjectSegmentProcessor(resumes, reader, profiles), { projects: [] }],
    ["skills", (reader) => new SkillsSegmentProcessor(resumes, reader, profiles), { skills: [] }],
    ["languages", (reader) => new LanguagesSegmentProcessor(resumes, reader, profiles), { languages: [] }],
    ["certifications", (reader) => new CertificationsSegmentProcessor(resumes, reader, profiles), { certifications: [] }],
  ])("asks the Model to read a %s Segment as its own kind", async (kind, processorOf, emptyReading) => {
    const { reader, recognize } = doubles(emptyReading);

    await processorOf(reader).recognize({ lines: ["Ada Lovelace"] }, CONTEXT);

    expect(recognize).toHaveBeenCalledWith(expect.objectContaining({ kind }));
  });
});
