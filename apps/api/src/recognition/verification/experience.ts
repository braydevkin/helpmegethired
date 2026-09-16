import type { DraftExperience, Period, SegmentRecognition } from "@helpmegethired/shared";

import { hasJobTitleWord, skillNamesIn } from "../../parser";
import type { RecognizedExperience } from "../../profile/segments/recognized";
import { alignEntries, type AlignedEntry, locatedByModel, locatedByRules, spanningEntryScore } from "./align-entries";
import { periodReadingOf, periodRule, textReadingOf, textRule, verifiedField, type Reading } from "./fields";
import { SegmentText } from "./segment-text";
import { distinctNames, skillNamesOf } from "./skill-names";

type ExperienceByModel = SegmentRecognition<"experience">["experiences"][number];

interface ExperienceReading {
  role: Reading<string>;
  company: Reading<string> | null;
  period: Reading<Period> | null;
  description: Reading<string> | null;
  skills: string[];
}

const roleRule = textRule(hasJobTitleWord);
const plainText = textRule();

function readingOf(text: SegmentText, experience: ExperienceByModel): ExperienceReading | null {
  const role = textReadingOf(text, experience.role);

  return role
    ? {
        role,
        company: textReadingOf(text, experience.company),
        period: periodReadingOf(text, experience.period),
        description: textReadingOf(text, experience.description),
        skills: skillNamesOf(text, experience.skills),
      }
    : null;
}

function merged({ byModel, byRules }: AlignedEntry<ExperienceReading, DraftExperience>): DraftExperience {
  if (byModel === null) {
    return byRules;
  }

  const description = verifiedField(byRules?.description ?? null, byModel.description, plainText);

  return {
    role: verifiedField(byRules?.role ?? null, byModel.role, roleRule),
    company: verifiedField(byRules?.company ?? null, byModel.company, plainText),
    period: verifiedField(byRules?.period ?? null, byModel.period, periodRule),
    description,
    skills: distinctNames([...(byRules?.skills ?? []), ...byModel.skills, ...skillNamesIn(description?.value ?? "")]),
  };
}

export function verifyExperience(lines: readonly string[], byRules: RecognizedExperience, byModel: SegmentRecognition<"experience">): RecognizedExperience {
  const text = new SegmentText(lines);
  const readings = byModel.experiences.flatMap((experience) => readingOf(text, experience) ?? []);
  const aligned = alignEntries(
    readings.map((reading) =>
      locatedByModel(reading, [reading.role.value, reading.company?.value], [reading.role, reading.company, reading.period, reading.description]),
    ),
    byRules.experiences.map((experience) =>
      locatedByRules(text, experience, [experience.role.value, experience.company?.value], [experience.role.value, experience.company?.value, experience.description?.value]),
    ),
    spanningEntryScore,
  );

  return { experiences: aligned.map(merged) };
}
