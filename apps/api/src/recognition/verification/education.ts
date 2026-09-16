import type { DraftEducation, Period, SegmentRecognition } from "@helpmegethired/shared";

import { hasDegreeTerm, readsAsInstitution } from "../../parser";
import type { RecognizedEducation } from "../../profile/segments/recognized";
import { alignEntries, type AlignedEntry, locatedByModel, locatedByRules, spanningEntryScore } from "./align-entries";
import { periodReadingOf, periodRule, textReadingOf, textRule, verifiedField, type Reading } from "./fields";
import { SegmentText } from "./segment-text";

type EducationByModel = SegmentRecognition<"education">["education"][number];

interface EducationReading {
  institution: Reading<string>;
  degree: Reading<string> | null;
  fieldOfStudy: Reading<string> | null;
  period: Reading<Period> | null;
}

const institutionRule = textRule(readsAsInstitution);
const degreeRule = textRule(hasDegreeTerm);
const plainText = textRule();

function readingOf(text: SegmentText, education: EducationByModel): EducationReading | null {
  const institution = textReadingOf(text, education.institution);

  return institution
    ? {
        institution,
        degree: textReadingOf(text, education.degree),
        fieldOfStudy: textReadingOf(text, education.fieldOfStudy),
        period: periodReadingOf(text, education.period),
      }
    : null;
}

function merged({ byModel, byRules }: AlignedEntry<EducationReading, DraftEducation>): DraftEducation {
  if (byModel === null) {
    return byRules;
  }

  return {
    institution: verifiedField(byRules?.institution ?? null, byModel.institution, institutionRule),
    degree: verifiedField(byRules?.degree ?? null, byModel.degree, degreeRule),
    fieldOfStudy: verifiedField(byRules?.fieldOfStudy ?? null, byModel.fieldOfStudy, plainText),
    period: verifiedField(byRules?.period ?? null, byModel.period, periodRule),
  };
}

export function verifyEducation(lines: readonly string[], byRules: RecognizedEducation, byModel: SegmentRecognition<"education">): RecognizedEducation {
  const text = new SegmentText(lines);
  const readings = byModel.education.flatMap((education) => readingOf(text, education) ?? []);
  const aligned = alignEntries(
    readings.map((reading) => {
      const { institution, degree, fieldOfStudy, period } = reading;

      return locatedByModel(reading, [institution.value, degree?.value, fieldOfStudy?.value], [institution, degree, fieldOfStudy, period]);
    }),
    byRules.education.map((education) => {
      const names = [education.institution.value, education.degree?.value, education.fieldOfStudy?.value];

      return locatedByRules(text, education, names, names);
    }),
    spanningEntryScore,
  );

  return { education: aligned.map(merged) };
}
