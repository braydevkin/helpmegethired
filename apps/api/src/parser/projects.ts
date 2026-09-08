import type { DraftProject, Field } from "@helpmegethired/shared";

import { endsAsSentence, headingOf, isHeadingLine, splitEntries, type RawEntry } from "./entries";
import { skillNamesIn } from "./skills";
import { hasLetters, isBlank } from "./text";

const NAME_SEPARATOR = /\s+[-–—]\s+|\s*\|\s*|\s*·\s*|:\s+/u;
const URL = /(?:https?:\/\/|www\.)[^\s)>\]]+/iu;
const URL_ENDING = /[.,;:)\]]+$/u;
const URL_WRAPPING = /\(\s*\)|\[\s*\]/gu;
const SPACES = /\s+/gu;

const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

const urlIn = (text: string): string | undefined => URL.exec(text)?.[0].replace(URL_ENDING, "");

const asUrl = (url: string): string => (/^https?:\/\//iu.test(url) ? url : `https://${url}`);

const withoutUrl = (text: string): string => text.replace(URL, "").replace(URL_WRAPPING, "").replace(SPACES, " ").trim();

// A project name is a short capitalised line that is not a sentence and not a bare link; one
// that follows a sentence opens the next project even without a blank line between them.
const isNameLine = (line: string): boolean =>
  isHeadingLine(line) && /^[\p{Lu}\p{N}]/u.test(line.trim()) && hasLetters(withoutUrl(line));

const opensEntry = (line: string, previous: string | undefined): boolean =>
  previous !== undefined && endsAsSentence(previous) && isNameLine(line);

function toProject(entry: RawEntry): DraftProject | undefined {
  const [nameLine = "", ...moreHeading] = headingOf(entry);
  const [name = "", ...afterName] = nameLine.split(NAME_SEPARATOR).map((part) => part.trim());
  const text = [...afterName, ...moreHeading, ...entry.descriptionLines].filter((line) => !isBlank(line)).join("\n");
  const url = urlIn(text) ?? urlIn(nameLine);
  const description = withoutUrl(text.replace(SPACES, " "));
  const cleanName = withoutUrl(name);

  if (!hasLetters(cleanName)) {
    return undefined;
  }

  return {
    name: field(cleanName, "high"),
    description: hasLetters(description) ? field(description, "high") : null,
    url: url ? field(asUrl(url), "high") : null,
    skills: skillNamesIn(`${cleanName}\n${description}`),
  };
}

export function extractProjects(lines: readonly string[]): DraftProject[] {
  return splitEntries(lines, opensEntry).flatMap((entry) => {
    const project = toProject(entry);

    return project ? [project] : [];
  });
}
