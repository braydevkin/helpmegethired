import { SkillCategorySchema, type Skill, type SkillCategory } from "@helpmegethired/shared";

export interface SkillGroup {
  name: SkillCategory;
  skills: readonly Skill[];
}

// The technology dictionary's categories in their own order; an empty one is not rendered.
export const skillGroupsOf = (skills: readonly Skill[]): SkillGroup[] =>
  SkillCategorySchema.options
    .map((name) => ({ name, skills: skills.filter((skill) => skill.category === name) }))
    .filter((group) => group.skills.length > 0);
