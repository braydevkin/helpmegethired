import type { ReactNode } from "react";

import { classNames } from "../../../lib/class-names";
import { Avatar } from "../../atoms/avatar/avatar";
import { LogoMark } from "../../atoms/logo-mark/logo-mark";
import styles from "./site-template.module.css";

export interface SiteTemplateProps {
  stepLabel: string;
  candidate: { initials: string; name: string; email: string };
  signOut: ReactNode;
  heading?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

// The journey's frame: the header with the step label and the Candidate's initials over a
// centred column that rises in. A step that brings a sidebar gets the wider column instead,
// its heading across the top and a two-column grid below that stacks the sidebar above the
// main column on a narrow screen.
export function SiteTemplate({ stepLabel, candidate, signOut, heading, sidebar, children }: SiteTemplateProps) {
  const twoColumn = sidebar !== undefined;

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
      <main className={classNames(styles.main, twoColumn && styles.wideMain)}>
        <div className={classNames(styles.column, twoColumn && styles.wideColumn)}>
          {heading}
          {twoColumn ? (
            <div className={styles.grid}>
              {sidebar}
              <div className={styles.stack}>{children}</div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
