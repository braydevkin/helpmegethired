import { StatusDot, type StatusDotState } from "../../atoms/status-dot/status-dot";
import { classNames } from "../../../lib/class-names";
import styles from "./pipeline-stage-row.module.css";

export interface PipelineStageRowProps {
  title: string;
  detail: string;
  state: StatusDotState;
}

export function PipelineStageRow({ title, detail, state }: PipelineStageRowProps) {
  return (
    <li className={styles.row} data-state={state}>
      <StatusDot state={state} />
      <div>
        <p className={classNames(styles.title, state === "waiting" && styles.waiting)}>{title}</p>
        <p className={styles.detail}>{detail}</p>
      </div>
    </li>
  );
}
