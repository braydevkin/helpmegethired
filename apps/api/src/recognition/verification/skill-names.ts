import type { QuotedText } from "@helpmegethired/shared";

import { findTechnologies, technologyNamed, type Technology } from "../../parser";
import { comparable, holdsWords, type SegmentText } from "./segment-text";

export interface SkillReading {
  name: string;
  technology: Technology | undefined;
}

// The dictionary names a skill only when its quote names the same technology, so a quote cannot
// vouch for a technology it never mentions.
function technologyOf({ value, quote }: QuotedText): Technology | undefined {
  const named = technologyNamed(value);

  if (named && findTechnologies(quote).some((technology) => technology.name === named.name)) {
    return named;
  }

  return technologyNamed(quote);
}

// A skill the dictionary knows takes its canonical name; one it does not know must be written
// in its quote as the Model spelled it.
export function skillReadingOf(text: SegmentText, quoted: QuotedText): SkillReading | null {
  if (!text.linesOf(quoted.quote)) {
    return null;
  }

  const technology = technologyOf(quoted);

  if (technology) {
    return { name: technology.name, technology };
  }

  return holdsWords(quoted.quote, quoted.value) ? { name: quoted.value, technology: undefined } : null;
}

export const skillNamesOf = (text: SegmentText, skills: readonly QuotedText[]): string[] =>
  skills.flatMap((skill) => skillReadingOf(text, skill)?.name ?? []);

// "C", "C++", and "C#" read the same once punctuation is gone, so a known skill is told apart by
// its canonical name.
export const skillKeyOf = (name: string): string => technologyNamed(name)?.name ?? comparable(name);

export function distinctNames(names: readonly string[]): string[] {
  const byKey = new Map<string, string>();

  for (const name of names) {
    const key = skillKeyOf(name);

    if (!byKey.has(key)) {
      byKey.set(key, name);
    }
  }

  return [...byKey.values()];
}
