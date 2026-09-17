import type { SegmentRecognition } from "@helpmegethired/shared";

import { headerOf, isContactLine } from "../../parser";
import type { RecognizedHeader } from "../../profile/segments/recognized";
import { textReadingOf, textRule, urlReadingOf, urlRule, verifiedField, type Reading } from "./fields";
import { SegmentText, comparable } from "./segment-text";

const plainText = textRule();

// Name, e-mail, and phone never reach a Profile table, so a headline or summary the Model quoted
// from a contact line, or that is the name the rules read, is not the Candidate's to keep.
const aboutTheCandidate = (lines: readonly string[], name: string | undefined) => (reading: Reading<string> | null) =>
  reading === null ||
  reading.lines.some((index) => isContactLine(lines[index] ?? "")) ||
  (name !== undefined && comparable(reading.value) === comparable(name))
    ? null
    : reading;

// The name and the e-mail stay the rules' alone: they are only compared with the Account, and a
// Model reading is never the reason a Candidate is told the resume names someone else.
export function verifyHeader(lines: readonly string[], byRules: RecognizedHeader, byModel: SegmentRecognition<"header">): RecognizedHeader {
  const text = new SegmentText(lines);
  const { basicProfile } = byRules;
  const withoutContact = aboutTheCandidate(lines, headerOf(lines).contact.name?.value);

  return {
    basicProfile: {
      headline: verifiedField(basicProfile.headline, withoutContact(textReadingOf(text, byModel.headline)), plainText),
      summary: verifiedField(basicProfile.summary, withoutContact(textReadingOf(text, byModel.summary)), plainText),
      linkedinUrl: verifiedField(basicProfile.linkedinUrl, urlReadingOf(text, byModel.linkedinUrl), urlRule),
      githubUrl: verifiedField(basicProfile.githubUrl, urlReadingOf(text, byModel.githubUrl), urlRule),
    },
    accountMismatch: byRules.accountMismatch,
  };
}
