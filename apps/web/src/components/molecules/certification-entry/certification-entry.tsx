import styles from "./certification-entry.module.css";

export interface CertificationEntryProps {
  name: string;
  meta: string | null;
}

export function CertificationEntry({ name, meta }: CertificationEntryProps) {
  return (
    <li>
      <p className={styles.name}>{name}</p>
      {meta && <p className={styles.meta}>{meta}</p>}
    </li>
  );
}
