import { useId } from "react";

import { Button } from "../../atoms/button/button";
import styles from "./locked-entry.module.css";

export interface LockedEntryProps {
  label: string;
  reason: string;
}

// The button stays focusable, so a keyboard or screen reader user reaches the step and hears why it is closed.
export function LockedEntry({ label, reason }: LockedEntryProps) {
  const reasonId = useId();

  return (
    <div className={styles.entry}>
      <Button type="button" aria-disabled="true" aria-describedby={reasonId} className={styles.button}>
        {label}
      </Button>
      <p id={reasonId} className={styles.reason}>
        {reason}
      </p>
    </div>
  );
}
