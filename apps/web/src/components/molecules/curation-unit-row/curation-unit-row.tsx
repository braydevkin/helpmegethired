import { StatusDot, type StatusDotState } from "../../atoms/status-dot/status-dot";
import { classNames } from "../../../lib/class-names";
import styles from "./curation-unit-row.module.css";

export interface CurationUnitRowProps {
  title: string;
  state: StatusDotState;
  statusLabel: string;
  detail?: string;
}

// One pass of the analysis. The dot is decoration; the status is written out so a screen
// reader hears it with the title.
export function CurationUnitRow({ title, state, statusLabel, detail }: CurationUnitRowProps) {
  return (
    <li className={classNames(styles.row, styles[state])} data-state={state}>
      <StatusDot state={state} />
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {detail && <p className={styles.detail}>{detail}</p>}
      </div>
      <p className={styles.status}>{statusLabel}</p>
    </li>
  );
}
