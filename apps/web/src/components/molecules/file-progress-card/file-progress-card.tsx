import { FileTypeMark } from "../../atoms/file-type-mark/file-type-mark";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import styles from "./file-progress-card.module.css";

export interface FileProgressCardProps {
  fileName: string;
  meta: string;
  percentage: number;
}

export function FileProgressCard({ fileName, meta, percentage }: FileProgressCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <FileTypeMark />
        <div className={styles.file}>
          <p className={styles.name} title={fileName}>
            {fileName}
          </p>
          <p className={styles.meta}>{meta}</p>
        </div>
        <p className={styles.percentage} data-testid="upload-percentage">
          {percentage}%
        </p>
      </div>
      <ProgressBar percentage={percentage} label="Upload progress" className={styles.bar} />
    </div>
  );
}
