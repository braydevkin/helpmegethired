import { classNames } from "../../../lib/class-names";
import styles from "./contact-row.module.css";

export interface ContactRowProps {
  label: string;
  value: string;
  href?: string;
  missing?: boolean;
}

// One way to reach the Candidate: its label over the value, or over what is not there yet.
export function ContactRow({ label, value, href, missing = false }: ContactRowProps) {
  return (
    <li className={styles.row}>
      <p className={styles.label}>{label}</p>
      {href ? (
        <a href={href} className={classNames(styles.value, styles.link)} rel="noreferrer noopener" target="_blank">
          {value}
        </a>
      ) : (
        <p className={classNames(styles.value, missing && styles.missing)}>{value}</p>
      )}
    </li>
  );
}
