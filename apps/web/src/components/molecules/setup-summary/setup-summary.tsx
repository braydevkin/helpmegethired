import { useId } from "react";

import { classNames } from "../../../lib/class-names";
import { Button } from "../../atoms/button/button";
import styles from "./setup-summary.module.css";

export interface SetupRow {
  label: string;
  value: string;
  pending?: boolean;
}

export interface SetupSummaryProps {
  rows: SetupRow[];
  action: { href: string; label: string };
  ready: boolean;
  reason: string;
  hint: string;
}

// Until the setup is ready the action is a disabled button, not a link, so it is announced as
// unavailable together with its reason instead of leading nowhere.
export function SetupSummary({ rows, action, ready, reason, hint }: SetupSummaryProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const noteId = `${id}-note`;

  return (
    <aside aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.title}>
        Your setup
      </h2>
      <dl className={styles.rows}>
        {rows.map(({ label, value, pending = false }) => (
          <div key={label}>
            <dt className={styles.label}>{label}</dt>
            <dd className={classNames(styles.value, pending && styles.pending)}>{value}</dd>
          </div>
        ))}
      </dl>
      {ready ? (
        <Button href={action.href} aria-describedby={noteId}>
          {action.label}
        </Button>
      ) : (
        <Button type="button" disabled aria-describedby={noteId}>
          {action.label}
        </Button>
      )}
      <p id={noteId} className={styles.note}>
        {ready ? hint : reason}
      </p>
    </aside>
  );
}
