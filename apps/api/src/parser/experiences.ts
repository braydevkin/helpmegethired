import type { DraftExperience } from "@helpmegethired/shared";

import { field } from "./field";
import { hasJobTitleWord } from "./dictionaries/job-titles";
import { headingOf, isHeadingLine, joinedDescription, splitEntries, type RawEntry } from "./entries";

const HEADING_MAX_PARTS = 3;
export const PART_SEPARATOR = /\s*\|\s*|\s+[-–—]\s+|\s*,\s*|\s+(?:em|at|@|na|no)\s+|\s+·\s+/iu;

// A short line naming a role and a company after a sentence opens an entry even when no
// blank line and no date line does, as a volunteer position listed without dates.
const isTitledHeading = (line: string): boolean => isHeadingLine(line) && hasJobTitleWord(line) && PART_SEPARATOR.test(line);

export const opensExperience = (line: string, previous: string | undefined): boolean =>
  previous !== undefined && !isHeadingLine(previous) && isTitledHeading(line);

export const partsOf = (headingLines: readonly string[]): string[] =>
  (headingLines.length > 1 ? headingLines : (headingLines[0] ?? "").split(PART_SEPARATOR))
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, HEADING_MAX_PARTS);

// The dictionary decides which part is the role when exactly one part carries a title word;
// otherwise both parts are kept as they are, with low confidence, for the Candidate to fix.
function roleAndCompany(headingLines: readonly string[]): Pick<DraftExperience, "role" | "company"> {
  const parts = partsOf(headingLines);
  const titled = parts.filter(hasJobTitleWord);

  if (titled.length === 1) {
    const role = titled[0]!;
    const company = parts.find((part) => part !== role);

    return { role: field(role, "high"), company: company ? field(company, "high") : null };
  }

  const [role = "", company] = parts;

  return { role: field(role, "low"), company: company ? field(company, "low") : null };
}

function toExperience(entry: RawEntry): DraftExperience | undefined {
  const headingLines = headingOf(entry);

  if (headingLines.length === 0) {
    return undefined;
  }

  const description = joinedDescription(entry.descriptionLines);

  return {
    ...roleAndCompany(headingLines),
    period: entry.match ? field(entry.match.period, "high") : null,
    description: description ? field(description, "high") : null,
    skills: [],
  };
}

export function extractExperiences(lines: readonly string[]): DraftExperience[] {
  return splitEntries(lines, opensExperience).flatMap((entry) => {
    const experience = toExperience(entry);

    return experience ? [experience] : [];
  });
}
