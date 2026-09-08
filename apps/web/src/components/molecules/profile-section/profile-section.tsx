import type { ReactNode } from "react";

import styles from "./profile-section.module.css";

export interface ProfileSectionProps {
  title: string;
  meta?: string;
  children: ReactNode;
}

// A card of the main column: its heading, what the heading counts, and the entries.
export function ProfileSection({ title, meta, children }: ProfileSectionProps) {
  return (
    <section aria-label={title} className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}
