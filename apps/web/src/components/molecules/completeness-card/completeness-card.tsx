import { CardLabel } from "../../atoms/card-label/card-label";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import styles from "./completeness-card.module.css";

export interface CompletenessCardProps {
  percentage: number;
  hint: string;
}

// How much of the Profile the analysis can work with, and the first points still missing.
export function CompletenessCard({ percentage, hint }: CompletenessCardProps) {
  return (
    <section aria-label="Completeness" className={styles.card}>
      <div className={styles.head}>
        <CardLabel>Completeness</CardLabel>
        <span className={styles.value}>{percentage}%</span>
      </div>
      <ProgressBar percentage={percentage} label="Profile completeness" className={styles.bar} />
      <p className={styles.hint}>{hint}</p>
    </section>
  );
}
