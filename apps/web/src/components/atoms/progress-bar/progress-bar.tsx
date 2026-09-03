import { classNames } from "../../../lib/class-names";
import styles from "./progress-bar.module.css";

export interface ProgressBarProps {
  steps: number;
  completed: number;
  className?: string;
}

export function ProgressBar({ steps, completed, className }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-label={`Step ${completed} of ${steps}`}
      aria-valuemin={0}
      aria-valuemax={steps}
      aria-valuenow={completed}
      className={classNames(styles.bar, className)}
    >
      {Array.from({ length: steps }, (_, index) => (
        <span key={index} className={classNames(styles.segment, index < completed && styles.filled)} />
      ))}
    </div>
  );
}
