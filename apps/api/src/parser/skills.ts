import type { DraftSkill } from "@helpmegethired/shared";

import { TECHNOLOGIES, type Technology } from "./dictionaries/technologies";
import type { SectionLines } from "./sections";

const TOKEN_SEPARATORS = /[\s/,;|·•()[\]{}"'“”‘’<>]+/u;
const LEADING_PUNCTUATION = /^[^\p{L}\p{N}.]+/u;
const TRAILING_PUNCTUATION = /[^\p{L}\p{N}+#]+$/u;
const DIACRITICS = /\p{Diacritic}/gu;

const trimToken = (raw: string): string => raw.replace(LEADING_PUNCTUATION, "").replace(TRAILING_PUNCTUATION, "");
const normaliseToken = (token: string): string => token.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

const bySynonym = new Map<string, Technology>(
  TECHNOLOGIES.flatMap((technology) => technology.synonyms.map((synonym) => [synonym, technology])),
);
const byExactSpelling = new Map<string, Technology>(
  TECHNOLOGIES.flatMap((technology) => technology.exact.map((spelling) => [spelling, technology])),
);
const longestTerm = Math.max(...[...bySynonym.keys(), ...byExactSpelling.keys()].map((key) => key.split(" ").length));

const tokensOf = (text: string): string[] =>
  text
    .split(TOKEN_SEPARATORS)
    .map(trimToken)
    .filter((token) => token.length > 0);

const technologyAt = (tokens: readonly string[], start: number, length: number): Technology | undefined => {
  const raw = tokens.slice(start, start + length);

  return bySynonym.get(raw.map(normaliseToken).join(" ")) ?? byExactSpelling.get(raw.join(" "));
};

// The longest term wins at each position, so "Google Cloud Platform" is one match and not
// three, and each technology is listed once, where it first appears.
export function findTechnologies(text: string): Technology[] {
  const tokens = tokensOf(text);
  const found = new Map<string, Technology>();
  let position = 0;

  while (position < tokens.length) {
    let advance = 1;

    for (let length = Math.min(longestTerm, tokens.length - position); length >= 1; length -= 1) {
      const technology = technologyAt(tokens, position, length);

      if (technology) {
        found.set(technology.name, technology);
        advance = length;
        break;
      }
    }

    position += advance;
  }

  return [...found.values()];
}

export const skillNamesIn = (text: string): string[] => findTechnologies(text).map((technology) => technology.name);

// A technology listed under a skills heading is high; one only mentioned in prose is medium.
export function extractSkills(sections: readonly SectionLines[]): DraftSkill[] {
  const skills = new Map<string, DraftSkill>();

  for (const section of sections) {
    const confidence = section.kind === "skills" ? "high" : "medium";

    for (const technology of findTechnologies(section.lines.join("\n"))) {
      const known = skills.get(technology.name);

      if (!known) {
        skills.set(technology.name, { name: technology.name, category: technology.category, confidence });
      } else if (confidence === "high") {
        known.confidence = "high";
      }
    }
  }

  return [...skills.values()];
}
