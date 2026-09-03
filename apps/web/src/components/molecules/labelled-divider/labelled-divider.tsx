import styles from "./labelled-divider.module.css";

export interface LabelledDividerProps {
  label: string;
}

export function LabelledDivider({ label }: LabelledDividerProps) {
  return (
    <div role="separator" aria-label={label} className={styles.divider}>
      <span className={styles.line} />
      <span className={styles.label}>{label}</span>
      <span className={styles.line} />
    </div>
  );
}
