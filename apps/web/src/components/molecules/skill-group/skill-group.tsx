import { Chip } from "../../atoms/chip/chip";
import styles from "./skill-group.module.css";

export interface SkillGroupProps {
  name: string;
  skills: readonly string[];
}

export function SkillGroup({ name, skills }: SkillGroupProps) {
  return (
    <div>
      <p className={styles.name}>{name}</p>
      <ul className={styles.chips}>
        {skills.map((skill) => (
          <li key={skill}>
            <Chip>{skill}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
