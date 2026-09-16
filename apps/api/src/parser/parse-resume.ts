import type {
  DraftBasicProfile,
  DraftCertification,
  DraftEducation,
  DraftExperience,
  DraftLanguage,
  DraftProject,
  ProfileDraft,
} from "@helpmegethired/shared";

import { field } from "./field";
import { extractCertifications } from "./certifications";
import { cleanText } from "./clean";
import { extractContact, isContactLine, type Contact } from "./contact";
import type { SectionKind } from "./dictionaries/section-headers";
import { extractEducation } from "./education";
import { extractExperiences } from "./experiences";
import { linesOfKind, ownLinesOf } from "./labelled-lines";
import { extractLanguages } from "./languages";
import { extractProjects } from "./projects";
import { splitSections, type Section, type SectionLines } from "./sections";
import { extractSkills, skillNamesIn } from "./skills";
import { isBlank } from "./text";

export const PARSER_VERSION = "rules/3";

export interface ParsedResume {
  contact: Contact;
  sections: Section[];
  draft: ProfileDraft;
}

export interface ResumeHeader {
  contact: Contact;
  basicProfile: DraftBasicProfile;
}

const HEADLINE_MAX_CHARACTERS = 80;
const HEADER_KINDS = new Set<SectionKind>(["header", "contact", "summary"]);

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
export function basicProfileOf(sections: readonly Section[], contact: Contact): DraftBasicProfile {
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

// The header reads the top of the resume and its summaries alone, headings included, so a link
// written further down, such as a Project's repository, is never taken for the Candidate's own.
export function headerOf(lines: readonly string[]): ResumeHeader {
  const topLines = splitSections(lines)
    .filter((section) => HEADER_KINDS.has(section.kind))
    .flatMap((section) => lines.slice(section.range.start, section.range.end));
  const sections = splitSections(topLines);
  const contact = extractContact(topLines.join("\n"), topLinesOf(sections));

  return { contact, basicProfile: basicProfileOf(sections, contact) };
}

// A technology named in an Experience's description belongs to that Experience as well.
export const withSkills = (experience: DraftExperience): DraftExperience => ({
  ...experience,
  skills: skillNamesIn(experience.description?.value ?? ""),
});

export const experiencesOf = (sections: readonly SectionLines[]): DraftExperience[] =>
  extractExperiences(ownLinesOf(sections, "experience")).map(withSkills);

export const educationOf = (sections: readonly SectionLines[]): DraftEducation[] => extractEducation(ownLinesOf(sections, "education"));

export const projectsOf = (sections: readonly SectionLines[]): DraftProject[] => extractProjects(ownLinesOf(sections, "projects"));

export const languagesOf = (sections: readonly SectionLines[]): DraftLanguage[] => extractLanguages(linesOfKind(sections, "languages"));

export const certificationsOf = (sections: readonly SectionLines[]): DraftCertification[] =>
  extractCertifications(linesOfKind(sections, "certifications"));

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
      experiences: experiencesOf(sections),
      education: educationOf(sections),
      projects: projectsOf(sections),
      skills: extractSkills(sections),
      languages: languagesOf(sections),
      certifications: certificationsOf(sections),
    },
  };
}
