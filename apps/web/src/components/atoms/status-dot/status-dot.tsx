import { classNames } from "../../../lib/class-names";
import styles from "./status-dot.module.css";

export type StatusDotState = "done" | "active" | "waiting" | "failed";
export type StatusDotSize = "stage" | "row";

export interface StatusDotProps {
  state: StatusDotState;
  size?: StatusDotSize;
  className?: string;
}

const MARKS: Record<StatusDotState, string> = { done: "✓", active: "•", waiting: "", failed: "!" };

// A 22px stage dot or a 16px row dot: filled when done, outlined while active, empty while
// waiting, red when the stage failed.
export function StatusDot({ state, size = "stage", className }: StatusDotProps) {
  return (
    <span aria-hidden="true" className={classNames(styles.dot, styles[size], styles[state], className)}>
      {MARKS[state]}
    </span>
  );
}
