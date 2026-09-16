import type { DraftSkill, SegmentRecognition } from "@helpmegethired/shared";

import type { RecognizedSkills } from "../../profile/segments/recognized";
import { SegmentText } from "./segment-text";
import { skillKeyOf, skillReadingOf } from "./skill-names";

type SkillByModel = SegmentRecognition<"skills">["skills"][number];

// The dictionary confirms a skill it knows, under its canonical name and category; one it does
// not know keeps the Model's spelling and category for the Candidate to review.
function skillOf(text: SegmentText, { name, category }: SkillByModel): DraftSkill | null {
  const reading = skillReadingOf(text, name);

  if (reading === null) {
    return null;
  }

  return reading.technology
    ? { name: reading.technology.name, category: reading.technology.category, confidence: "high" }
    : { name: reading.name, category, confidence: "medium" };
}

// The Model decides which skills exist: one the rules read too keeps the rules' reading at high,
// in the rules' order, and one the rules did not read follows; a skill only the rules read is left out.
export function verifySkills(lines: readonly string[], byRules: RecognizedSkills, byModel: SegmentRecognition<"skills">): RecognizedSkills {
  const text = new SegmentText(lines);
  const readByModel = new Map<string, DraftSkill>();

  for (const skill of byModel.skills.flatMap((each) => skillOf(text, each) ?? [])) {
    const key = skillKeyOf(skill.name);

    if (!readByModel.has(key)) {
      readByModel.set(key, skill);
    }
  }

  const confirmed = byRules.skills.filter((skill) => readByModel.has(skillKeyOf(skill.name))).map((skill): DraftSkill => ({ ...skill, confidence: "high" }));
  const confirmedKeys = new Set(confirmed.map((skill) => skillKeyOf(skill.name)));

  return { skills: [...confirmed, ...[...readByModel].flatMap(([key, skill]) => (confirmedKeys.has(key) ? [] : [skill]))] };
}
