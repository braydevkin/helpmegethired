import type { ReactNode } from "react";

import { CardLabel } from "../../atoms/card-label/card-label";
import { FileProgressCard } from "../../molecules/file-progress-card/file-progress-card";
import { PipelineStageRow, type PipelineStageRowProps } from "../../molecules/pipeline-stage-row/pipeline-stage-row";
import { ProfileDataRow, type ProfileDataRowProps } from "../../molecules/profile-data-row/profile-data-row";
import styles from "./ingestion-progress.module.css";

export interface IngestionProgressProps {
  file: { name: string; meta: string };
  percentage: number;
  stages: readonly PipelineStageRowProps[];
  rows: readonly ProfileDataRowProps[];
  found: { found: number; total: number };
  actions?: ReactNode;
  footnote?: string;
}

// The processing, done, and failed states share this layout: the file card, the pipeline,
// the Profile data, and whatever actions the state offers.
export function IngestionProgress({ file, percentage, stages, rows, found, actions, footnote }: IngestionProgressProps) {
  return (
    <div>
      <FileProgressCard fileName={file.name} meta={file.meta} percentage={percentage} />
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="pipeline-label">
          <CardLabel id="pipeline-label">Pipeline</CardLabel>
          <ol className={styles.stages}>
            {stages.map((stage) => (
              <PipelineStageRow key={stage.title} {...stage} />
            ))}
          </ol>
        </section>
        <section className={styles.card} aria-labelledby="profile-data-label">
          <div className={styles.cardHead}>
            <CardLabel id="profile-data-label">Profile data</CardLabel>
            <span className={styles.count} data-testid="profile-data-count">
              {found.found} of {found.total}
            </span>
          </div>
          <ul className={styles.rows}>
            {rows.map((row) => (
              <ProfileDataRow key={row.label} {...row} />
            ))}
          </ul>
        </section>
      </div>
      {(actions || footnote) && (
        <div className={styles.actions}>
          {actions}
          {footnote && <p className={styles.footnote}>{footnote}</p>}
        </div>
      )}
    </div>
  );
}
