import type { ReactNode } from "react";

import styles from "./warning-notice.module.css";

export interface WarningNoticeProps {
  children: ReactNode;
}

// A tinted yellow card with a `!` mark drawn by the stylesheet: what still needs a look.
export function WarningNotice({ children }: WarningNoticeProps) {
  return (
    <div role="status" className={styles.notice}>
      {children}
    </div>
  );
}
