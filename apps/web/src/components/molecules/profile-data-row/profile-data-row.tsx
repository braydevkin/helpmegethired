import { StatusDot } from "../../atoms/status-dot/status-dot";
import { classNames } from "../../../lib/class-names";
import styles from "./profile-data-row.module.css";

export interface ProfileDataRowProps {
  label: string;
  value: string | undefined;
}

// A part of the Profile: dim until its Segment is saved, then its label and value.
export function ProfileDataRow({ label, value }: ProfileDataRowProps) {
  const found = value !== undefined;

  return (
    <li className={classNames(styles.row, !found && styles.unfound)} data-found={found}>
      <StatusDot size="row" state={found ? "done" : "waiting"} />
      <span className={styles.label}>{label}</span>
      {found && <span className={styles.value}>{value}</span>}
    </li>
  );
}
