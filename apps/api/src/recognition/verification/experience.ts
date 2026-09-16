import type { DraftExperience, Period, SegmentRecognition } from "@helpmegethired/shared";

import { hasJobTitleWord, skillNamesIn } from "../../parser";
import type { RecognizedExperience } from "../../profile/segments/recognized";
import { alignEntries, type AlignedEntry, locatedEntries, spanningEntryScore } from "./align-entries";
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
    locatedEntries(
      text,
      readings.map((reading) => ({
        entry: reading,
        names: [reading.role.value, reading.company?.value],
        texts: [reading.role.quote, reading.company?.quote, reading.period?.quote, reading.description?.quote],
      })),
    ),
    locatedEntries(
      text,
      byRules.experiences.map((experience) => ({
        entry: experience,
        names: [experience.role.value, experience.company?.value],
        texts: [experience.role.value, experience.company?.value, experience.description?.value],
      })),
    ),
    spanningEntryScore,
  );

  return { experiences: aligned.map(merged) };
}
