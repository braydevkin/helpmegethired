import { SkillGroup, type SkillGroupProps } from "../../molecules/skill-group/skill-group";
import { ProfileSection } from "../../molecules/profile-section/profile-section";
import styles from "./skills-groups.module.css";

export interface SkillsGroupsProps {
  groups: readonly SkillGroupProps[];
  meta: string;
}

// The Skills by the category the technology dictionary gave them.
export function SkillsGroups({ groups, meta }: SkillsGroupsProps) {
  return (
    <ProfileSection title="Skills" meta={meta}>
      <div className={styles.groups}>
        {groups.map((group) => (
          <SkillGroup key={group.name} {...group} />
        ))}
      </div>
    </ProfileSection>
  );
}
