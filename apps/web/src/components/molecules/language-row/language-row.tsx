import styles from "./language-row.module.css";

export interface LanguageRowProps {
  name: string;
  level: string | null;
}

export function LanguageRow({ name, level }: LanguageRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.name}>{name}</span>
      {level && <span className={styles.level}>{level}</span>}
    </li>
  );
}
