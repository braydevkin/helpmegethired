import type { CurationProgress } from "@helpmegethired/shared";
import { useId } from "react";

import { Chip } from "../../atoms/chip/chip";
import { LocalTime } from "../../atoms/local-time/local-time";
import { ProgressBar } from "../../atoms/progress-bar/progress-bar";
import { CurationUnitRow } from "../../molecules/curation-unit-row/curation-unit-row";
import { classNames } from "../../../lib/class-names";
import { focusIndexOf, footnoteOf, headingOf, metricChipsOf, passLabelOf, pausedNoticeOf, phaseOf, unitRowOf, unitWindowOf } from "../../../lib/curation-progress/view";
import styles from "./analysis-progress.module.css";

export interface AnalysisProgressProps {
  progress: CurationProgress;
  windowSize?: number;
  variant?: "card" | "page";
}

interface ProgressPartProps {
  progress: CurationProgress;
  inPage: boolean;
}

// Everything here is read from the payload: the percentage is the API's share of saved units
// and nothing advances between two answers. The analysis page lists every pass and the counted
// facts in panels of its own, so its variant carries only the pass being read.
export function AnalysisProgress({ progress, windowSize, variant = "card" }: AnalysisProgressProps) {
  const titleId = useId();
  const inPage = variant === "page";
  const phase = phaseOf(progress);
  const footnote = footnoteOf(progress);

  return (
    <section className={classNames(styles.card, styles[phase])} aria-labelledby={titleId} data-phase={phase}>
      <ProgressHead titleId={titleId} progress={progress} inPage={inPage} />
      <ProgressBar percentage={progress.percentage} label="Analysis progress" className={styles.bar} />
      <ProgressMeta progress={progress} inPage={inPage} />
      {phase === "paused" && progress.resumeAfter && <PausedNotice progress={progress} resumeAfter={progress.resumeAfter} />}
      {!inPage && <ProgressBreakdown progress={progress} windowSize={windowSize} />}
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </section>
  );
}

function PausedNotice({ progress, resumeAfter }: { progress: CurationProgress; resumeAfter: string }) {
  const { lead, withDate } = pausedNoticeOf(progress);

  return (
    <p role="status" className={styles.notice}>
      {lead} <LocalTime dateTime={resumeAfter} withDate={withDate} />.
    </p>
  );
}

function ProgressHead({ titleId, progress, inPage }: ProgressPartProps & { titleId: string }) {
  const heading = inPage ? { title: passLabelOf(progress), lead: undefined } : headingOf(progress);

  return (
    <div className={styles.head}>
      <span aria-hidden="true" className={styles.mark} />
      <div className={styles.heading}>
        <h2 id={titleId} className={styles.title}>
          {heading.title}
        </h2>
        {heading.lead && <p className={styles.lead}>{heading.lead}</p>}
      </div>
      <p className={styles.percentage} data-testid="analysis-percentage">
        {progress.percentage}%
      </p>
    </div>
  );
}

function ProgressMeta({ progress, inPage }: ProgressPartProps) {
  return (
    <div className={styles.meta}>
      {!inPage && (
        <p className={styles.pass} aria-live="polite">
          {passLabelOf(progress)}
        </p>
      )}
      <p className={styles.saved} data-testid="analysis-saved" aria-live={inPage ? "polite" : undefined}>
        {progress.units.saved} of {progress.units.total} saved
      </p>
    </div>
  );
}

function ProgressBreakdown({ progress, windowSize }: { progress: CurationProgress; windowSize: number | undefined }) {
  const rows = unitWindowOf(progress.units.list, focusIndexOf(progress.units.list), windowSize).map(unitRowOf);
  const chips = metricChipsOf(progress.metrics);

  return (
    <>
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
    </>
  );
}
