import type { DraftBasicProfile, DraftExperience, Field, ProfileDraft } from "@helpmegethired/shared";

import { extractCertifications } from "./certifications";
import { cleanText } from "./clean";
import { extractContact, isContactLine, type Contact } from "./contact";
import { extractEducation } from "./education";
import { extractExperiences } from "./experiences";
import { linesOfKind, ownLinesOf } from "./labelled-lines";
import { extractLanguages } from "./languages";
import { extractProjects } from "./projects";
import { splitSections, type Section } from "./sections";
import { extractSkills, skillNamesIn } from "./skills";
import { isBlank } from "./text";

export const PARSER_VERSION = "rules/3";

export interface ParsedResume {
  contact: Contact;
  sections: Section[];
  draft: ProfileDraft;
}

const HEADLINE_MAX_CHARACTERS = 80;

const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

const paragraph = (lines: readonly string[]): string =>
  lines
    .filter((line) => !isBlank(line))
    .join(" ")
    .trim();

// The top of the resume is what comes before the first section about the Candidate's
// history: the header and, on a LinkedIn export, a contact block.
const isTop = (section: Section): boolean => section.kind === "header" || section.kind === "contact";

export const topLinesOf = (sections: readonly Section[]): string[] => {
  const top: string[] = [];

  for (const section of sections) {
    if (!isTop(section)) {
      break;
    }

    top.push(...section.lines);
  }

  return top;
};

// The top's free lines are the ones that are neither the name nor contact details: the
// first short one is the headline, the rest a summary when no summary section exists.
function basicProfileOf(sections: readonly Section[], contact: Contact): DraftBasicProfile {
  const summaries = sections.filter((section) => section.kind === "summary");
  const free = topLinesOf(sections).filter(
    (line) => !isBlank(line) && line.trim() !== contact.name?.value && !isContactLine(line),
  );
  const headline = free.find((line) => line.length <= HEADLINE_MAX_CHARACTERS);
  const rest = free.filter((line) => line !== headline);
  const summaryText = summaries.length > 0 ? paragraph(summaries.flatMap((section) => section.lines)) : paragraph(rest);

  return {
    headline: headline ? field(headline, "medium") : null,
    summary: summaryText ? field(summaryText, summaries.length > 0 ? "high" : "low") : null,
    linkedinUrl: contact.linkedinUrl,
    githubUrl: contact.githubUrl,
  };
}

// A technology named in an Experience's description belongs to that Experience as well.
const withSkills = (experience: DraftExperience): DraftExperience => ({
  ...experience,
  skills: skillNamesIn(experience.description?.value ?? ""),
});

export function parseResume(rawText: string): ParsedResume {
  const text = cleanText(rawText);
  const sections = splitSections(text.split("\n"));
  const contact = extractContact(text, topLinesOf(sections));

  return {
    contact,
    sections,
    draft: {
      parserVersion: PARSER_VERSION,
      basicProfile: basicProfileOf(sections, contact),
      experiences: extractExperiences(ownLinesOf(sections, "experience")).map(withSkills),
      education: extractEducation(ownLinesOf(sections, "education")),
      projects: extractProjects(ownLinesOf(sections, "projects")),
      skills: extractSkills(sections),
      languages: extractLanguages(linesOfKind(sections, "languages")),
      certifications: extractCertifications(linesOfKind(sections, "certifications")),
    },
  };
}
