import { classNames } from "../../../lib/class-names";
import styles from "./progress-bar.module.css";

export interface SteppedProgressBarProps {
  steps: number;
  completed: number;
  className?: string;
}

export interface FillProgressBarProps {
  percentage: number;
  label: string;
  className?: string;
}

export type ProgressBarProps = SteppedProgressBarProps | FillProgressBarProps;

// Two looks of one bar: the Account steps as segments, or an 8px fill for a percentage.
export function ProgressBar(props: ProgressBarProps) {
  return "percentage" in props ? <FillProgressBar {...props} /> : <SteppedProgressBar {...props} />;
}

function SteppedProgressBar({ steps, completed, className }: SteppedProgressBarProps) {
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

function FillProgressBar({ percentage, label, className }: FillProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={classNames(styles.track, className)}
    >
      <span className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
