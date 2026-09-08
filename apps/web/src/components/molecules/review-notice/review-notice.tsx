import { WarningNotice } from "../../atoms/warning-notice/warning-notice";
import styles from "./review-notice.module.css";

export interface ReviewNoticeProps {
  title: string;
  detail: string;
}

// What the Ingestion recognized with low confidence, counted and named.
export function ReviewNotice({ title, detail }: ReviewNoticeProps) {
  return (
    <WarningNotice>
      <div>
        <p className={styles.title}>{title}</p>
        <p className={styles.detail}>{detail}</p>
      </div>
    </WarningNotice>
  );
}
