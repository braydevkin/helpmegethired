import type { ReactNode } from "react";

import { Eyebrow } from "../../atoms/eyebrow/eyebrow";
import styles from "./profile-heading.module.css";

export interface ProfileHeadingProps {
  eyebrow: string;
  name: string;
  headline: string;
  actions: ReactNode;
}

// The name the Account carries, the headline the Ingestion recognized, and the two actions
// the review offers.
export function ProfileHeading({ eyebrow, name, headline, actions }: ProfileHeadingProps) {
  return (
    <div className={styles.heading}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className={styles.name}>{name}</h1>
        <p className={styles.headline}>{headline}</p>
      </div>
      <div className={styles.actions}>{actions}</div>
    </div>
  );
}
