import type { ReactNode } from "react";

import { Avatar } from "../../atoms/avatar/avatar";
import { LogoMark } from "../../atoms/logo-mark/logo-mark";
import styles from "./site-template.module.css";

export interface SiteTemplateProps {
  stepLabel: string;
  candidate: { initials: string; name: string; email: string };
  signOut: ReactNode;
  children: ReactNode;
}

// The journey's frame: the header with the step label and the Candidate's initials over a
// centred column that rises in.
export function SiteTemplate({ stepLabel, candidate, signOut, children }: SiteTemplateProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <LogoMark className={styles.mark} />
          <span className={styles.name}>Help me get hired</span>
        </div>
        <div className={styles.account}>
          <span className={styles.step}>{stepLabel}</span>
          <Avatar initials={candidate.initials} name={candidate.name} />
          <span className={styles.email} data-testid="account-email">
            {candidate.email}
          </span>
          {signOut}
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.column}>{children}</div>
      </main>
    </div>
  );
}
