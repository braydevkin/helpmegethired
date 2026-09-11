import { useId, type ReactNode } from "react";

import styles from "./failure-banner.module.css";

export interface FailureBannerProps {
  title: string;
  subject?: string | undefined;
  reason: string;
  action: ReactNode;
}

// What stopped the analysis, in plain words, beside the action that picks it up again.
export function FailureBanner({ title, subject, reason, action }: FailureBannerProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={styles.banner}>
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {subject && <p className={styles.subject}>“{subject}”</p>}
        <p className={styles.reason}>{reason}</p>
      </div>
      <div className={styles.action}>{action}</div>
    </section>
  );
}
