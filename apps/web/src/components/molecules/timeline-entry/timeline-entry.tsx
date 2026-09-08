import type { ReactNode } from "react";

import { TimelineMarker } from "../../atoms/timeline-marker/timeline-marker";
import styles from "./timeline-entry.module.css";

export interface TimelineEntryProps {
  title: string;
  period: string | null;
  subtitle: string | null;
  children?: ReactNode;
}

// One step of a history: the marker, what it was called, when, where, and whatever the
// section adds below — a description, its skills, or what still needs confirming.
export function TimelineEntry({ title, period, subtitle, children }: TimelineEntryProps) {
  return (
    <li className={styles.entry}>
      <TimelineMarker />
      <div>
        <div className={styles.head}>
          <h3 className={styles.title}>{title}</h3>
          {period && <span className={styles.period}>{period}</span>}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
    </li>
  );
}
