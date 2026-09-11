import type { CurationProgress } from "@helpmegethired/shared";
import { useId } from "react";

import { Chip } from "../../atoms/chip/chip";
import { LocalTime } from "../../atoms/local-time/local-time";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import { CurationUnitRow } from "../../molecules/curation-unit-row/curation-unit-row";
import { classNames } from "../../../lib/class-names";
import { focusIndexOf, footnoteOf, headingOf, metricChipsOf, passLabelOf, phaseOf, unitRowOf, unitWindowOf } from "../../../lib/curation-progress/view";
import styles from "./analysis-progress.module.css";

export interface AnalysisProgressProps {
  progress: CurationProgress;
  windowSize?: number;
}

// Everything here is read from the payload: the percentage is the API's share of saved units
// and nothing advances between two answers.
export function AnalysisProgress({ progress, windowSize }: AnalysisProgressProps) {
  const titleId = useId();
  const phase = phaseOf(progress);
  const heading = headingOf(progress);
  const footnote = footnoteOf(progress);
  const chips = metricChipsOf(progress.metrics);
  const rows = unitWindowOf(progress.units.list, focusIndexOf(progress.units.list), windowSize).map(unitRowOf);

  return (
    <section className={classNames(styles.card, styles[phase])} aria-labelledby={titleId} data-phase={phase}>
      <div className={styles.head}>
        <span aria-hidden="true" className={styles.mark} />
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {heading.title}
          </h2>
          <p className={styles.lead}>{heading.lead}</p>
        </div>
        <p className={styles.percentage} data-testid="analysis-percentage">
          {progress.percentage}%
        </p>
      </div>
      <ProgressBar percentage={progress.percentage} label="Analysis progress" className={styles.bar} />
      <div className={styles.meta}>
        <p className={styles.pass} aria-live="polite">
          {passLabelOf(progress)}
        </p>
        <p className={styles.saved} data-testid="analysis-saved">
          {progress.units.saved} of {progress.units.total} saved
        </p>
      </div>
      {phase === "paused" && progress.resumeAfter && (
        <p role="status" className={styles.notice}>
          Paused by your AI provider. Resumes at <LocalTime dateTime={progress.resumeAfter} />.
        </p>
      )}
      {rows.length > 0 && (
        <ol className={styles.units} aria-label="Passes">
          {rows.map(({ id, ...row }) => (
            <CurationUnitRow key={id} {...row} />
          ))}
        </ol>
      )}
      {chips.length > 0 && (
        <ul className={styles.chips} aria-label="Counted from your dates">
          {chips.map((chip) => (
            <li key={chip}>
              <Chip>{chip}</Chip>
            </li>
          ))}
        </ul>
      )}
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </section>
  );
}
