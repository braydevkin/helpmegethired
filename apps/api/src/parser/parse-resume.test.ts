import { ProfileDraftSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { PARSER_VERSION, parseResume } from "./parse-resume";

const english = [
  "Ada Lovelace",
  "Senior Backend Engineer",
  "London · ada@example.com · +44 20 7946 0958",
  "linkedin.com/in/ada-lovelace",
  "",
  "SUMMARY",
  "Ten years building queues and",
  "ingestion pipelines.",
  "",
  "EXPERIENCE",
  "Acme — Senior Engineer",
  "2019 - present",
].join("\n");

describe("parseResume", () => {
  it("answers the contact, the sections, and a draft that validates against the shared schema", () => {
    const parsed = parseResume(english);

    expect(parsed.contact.name?.value).toBe("Ada Lovelace");
    expect(parsed.sections.map((section) => section.kind)).toEqual(["header", "summary", "experience"]);
    expect(ProfileDraftSchema.parse(parsed.draft)).toEqual(parsed.draft);
    expect(parsed.draft.parserVersion).toBe(PARSER_VERSION);
  });

  it("takes the headline from the header and the summary from its section", () => {
    const { basicProfile } = parseResume(english).draft;

    expect(basicProfile).toEqual({
      headline: { value: "Senior Backend Engineer", confidence: "medium" },
      summary: { value: "Ten years building queues and ingestion pipelines.", confidence: "high" },
      linkedinUrl: { value: "https://linkedin.com/in/ada-lovelace", confidence: "high" },
      githubUrl: null,
    });
  });

  it("falls back to the header's remaining lines for a low-confidence summary", () => {
    const { basicProfile } = parseResume("Ada Lovelace\nBackend engineer\nI build queues.\nAnd pipelines.\n\nExperience\nAcme").draft;

    expect(basicProfile.headline?.value).toBe("Backend engineer");
    expect(basicProfile.summary).toEqual({ value: "I build queues. And pipelines.", confidence: "low" });
  });

  it("reads the name and the headline after a leading contact block, as a LinkedIn export has", () => {
    const parsed = parseResume("Contact\nada@example.com\nAda Lovelace\nBackend engineer\nLondon\n\nSummary\nQueues.\n\nExperience\nAcme");

    expect(parsed.sections.map((section) => section.kind)).toEqual(["contact", "summary", "experience"]);
    expect(parsed.contact.name?.value).toBe("Ada Lovelace");
    expect(parsed.draft.basicProfile.headline?.value).toBe("Backend engineer");
  });

  it("answers an empty draft for empty text", () => {
    const parsed = parseResume("");

    expect(parsed.sections).toEqual([]);
    expect(parsed.draft.basicProfile).toEqual({ headline: null, summary: null, linkedinUrl: null, githubUrl: null });
  });
});
