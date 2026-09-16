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

export function verifySkills(lines: readonly string[], byRules: RecognizedSkills, byModel: SegmentRecognition<"skills">): RecognizedSkills {
  const text = new SegmentText(lines);
  const skills = new Map(byRules.skills.map((skill) => [skillKeyOf(skill.name), skill]));
  const readByRules = new Set(skills.keys());

  for (const skill of byModel.skills.flatMap((each) => skillOf(text, each) ?? [])) {
    const key = skillKeyOf(skill.name);
    const known = skills.get(key);

    if (!known) {
      skills.set(key, skill);
    } else if (readByRules.has(key)) {
      skills.set(key, { ...known, confidence: "high" });
    }
  }

  return { skills: [...skills.values()] };
}
