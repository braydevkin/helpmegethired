import type { ReactNode } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./inline-notice.module.css";

export interface InlineNoticeProps {
  children: ReactNode;
  className?: string;
}

// A tinted red row with a `!` mark drawn by the stylesheet, so the alert reads as its
// message alone: the rejection of a file before anything is sent.
export function InlineNotice({ children, className }: InlineNoticeProps) {
  return (
    <div role="alert" className={classNames(styles.notice, className)}>
      {children}
    </div>
  );
}
