import type { DraftCertification, SegmentRecognition } from "@helpmegethired/shared";

import type { RecognizedCertifications } from "../../profile/segments/recognized";
import { alignEntries, type AlignedEntry, locatedByModel, locatedByRules, oneLineEntryScore } from "./align-entries";
import { quotedReadingOf, textReadingOf, textRule, verifiedField, yearRule, type Reading } from "./fields";
import { SegmentText } from "./segment-text";

type CertificationByModel = SegmentRecognition<"certifications">["certifications"][number];

interface CertificationReading {
  name: Reading<string>;
  issuer: Reading<string> | null;
  year: Reading<number> | null;
}

const plainText = textRule();

function readingOf(text: SegmentText, certification: CertificationByModel): CertificationReading | null {
  const name = textReadingOf(text, certification.name);

  return name ? { name, issuer: textReadingOf(text, certification.issuer), year: quotedReadingOf(text, certification.year) } : null;
}

function merged({ byModel, byRules }: AlignedEntry<CertificationReading, DraftCertification>): DraftCertification {
  if (byModel === null) {
    return byRules;
  }

  return {
    name: verifiedField(byRules?.name ?? null, byModel.name, plainText),
    issuer: verifiedField(byRules?.issuer ?? null, byModel.issuer, plainText),
    year: verifiedField(byRules?.year ?? null, byModel.year, yearRule),
  };
}

export function verifyCertifications(
  lines: readonly string[],
  byRules: RecognizedCertifications,
  byModel: SegmentRecognition<"certifications">,
): RecognizedCertifications {
  const text = new SegmentText(lines);
  const readings = byModel.certifications.flatMap((certification) => readingOf(text, certification) ?? []);
  const aligned = alignEntries(
    readings.map((reading) => locatedByModel(reading, [reading.name.value], [reading.name, reading.issuer, reading.year])),
    byRules.certifications.map((certification) =>
      locatedByRules(text, certification, [certification.name.value], [certification.name.value, certification.issuer?.value]),
    ),
    oneLineEntryScore,
  );

  return { certifications: aligned.map(merged) };
}
