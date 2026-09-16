import type { DraftLanguage, SegmentRecognition } from "@helpmegethired/shared";

import { hasLevelWord } from "../../parser";
import type { RecognizedLanguages } from "../../profile/segments/recognized";
import { alignEntries, type AlignedEntry, locatedByModel, locatedByRules, oneLineEntryScore } from "./align-entries";
import { textReadingOf, textRule, verifiedField, type Reading } from "./fields";
import { SegmentText } from "./segment-text";

type LanguageByModel = SegmentRecognition<"languages">["languages"][number];

interface LanguageReading {
  name: Reading<string>;
  level: Reading<string> | null;
}

const levelRule = textRule(hasLevelWord);
const plainText = textRule();

function readingOf(text: SegmentText, language: LanguageByModel): LanguageReading | null {
  const name = textReadingOf(text, language.name);

  return name ? { name, level: textReadingOf(text, language.level) } : null;
}

function merged({ byModel, byRules }: AlignedEntry<LanguageReading, DraftLanguage>): DraftLanguage {
  if (byModel === null) {
    return byRules;
  }

  return {
    name: verifiedField(byRules?.name ?? null, byModel.name, plainText),
    level: verifiedField(byRules?.level ?? null, byModel.level, levelRule),
  };
}

export function verifyLanguages(lines: readonly string[], byRules: RecognizedLanguages, byModel: SegmentRecognition<"languages">): RecognizedLanguages {
  const text = new SegmentText(lines);
  const readings = byModel.languages.flatMap((language) => readingOf(text, language) ?? []);
  const aligned = alignEntries(
    readings.map((reading) => locatedByModel(reading, [reading.name.value], [reading.name, reading.level])),
    byRules.languages.map((language) => locatedByRules(text, language, [language.name.value], [language.name.value, language.level?.value])),
    oneLineEntryScore,
  );

  return { languages: aligned.map(merged) };
}
