import type { CurationProgress } from "@helpmegethired/shared";
import { useId } from "react";

import { Button } from "../../../../components/atoms/button/button";
import { FailureBanner } from "../../../../components/molecules/failure-banner/failure-banner";
import { LockedEntry } from "../../../../components/molecules/locked-entry/locked-entry";
import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import { CountedFacts } from "../../../../components/organisms/counted-facts/counted-facts";
import { CurationUnitsPanel } from "../../../../components/organisms/curation-units-panel/curation-units-panel";
import { RunDetails } from "../../../../components/organisms/run-details/run-details";
import { countedFactsOf, failureOf, jobMatchingLockOf, pageHeadingOf, rerunReasonOf, runDetailsOf, type RunSource } from "../../../../lib/curation-analysis/view";
import type { CurationActions } from "./use-curation-actions";
import styles from "./analysis.module.css";

const STOPPED_TITLE = "You stopped the analysis";
const STOPPED_REASON = "Everything saved before you stopped it is kept. Trying again picks up where it stopped.";
const CLOSING_NOTE = "Your profile is indexed. Matching a job description reads this analysis instead of your PDF.";

interface ActionsProps {
  actions: CurationActions;
}

interface ProgressSectionProps {
  progress: CurationProgress;
}

export function AnalysisHeader({ progress, completed }: ProgressSectionProps & { completed: boolean }) {
  const heading = pageHeadingOf(progress);

  return (
    <div className={styles.top}>
      <ScreenHeading tone={heading.tone} eyebrow={heading.eyebrow} title={heading.title} lead={heading.lead} />
      <LockedEntry label="Paste a job description" reason={jobMatchingLockOf(completed)} />
    </div>
  );
}

export function ReplacedAnalysis({ journeyHref }: { journeyHref: string }) {
  return (
    <div className={styles.gate}>
      <ScreenHeading tone="warning" eyebrow="Replaced" title="A newer résumé replaced this analysis" lead="Confirm the new profile and its analysis starts on its own." />
      <div className={styles.actions}>
        <Button href={journeyHref}>Back to your journey</Button>
      </div>
    </div>
  );
}

function PickUpButton({ actions }: ActionsProps) {
  const [label, pickUp] = actions.rerunInstead ? ["Run it again", actions.runAgain] : ["Try again", actions.tryAgain];

  return (
    <Button type="button" onClick={pickUp} aria-disabled={actions.acting}>
      {label}
    </Button>
  );
}

export function StoppedBanner({ progress, actions, modelChoiceHref }: ProgressSectionProps & ActionsProps & { modelChoiceHref: string }) {
  const failure = failureOf(progress);

  return (
    <FailureBanner
      title={failure?.title ?? STOPPED_TITLE}
      subject={failure?.subject}
      reason={failure?.reason ?? STOPPED_REASON}
      action={
        <>
          <PickUpButton actions={actions} />
          {failure?.needsNewKey && (
            <Button variant="secondary" href={modelChoiceHref}>
              Save a new key
            </Button>
          )}
        </>
      }
    />
  );
}

export function RunPanels({ progress, run, actions, running }: ProgressSectionProps & ActionsProps & { run: RunSource; running: boolean }) {
  return (
    <div className={styles.grid}>
      <CurationUnitsPanel units={progress.units.list} saved={progress.units.saved} />
      <div className={styles.side}>
        <CountedFacts facts={countedFactsOf(progress.metrics)} />
        <RunDetails {...runDetailsOf(progress, run)} />
        {running && (
          <Button variant="secondary" type="button" onClick={actions.stop} aria-disabled={actions.acting}>
            Stop the analysis
          </Button>
        )}
      </div>
    </div>
  );
}

// The progress carries the API's own re-run gate, so a re-run it would refuse is disabled with the
// reason before any click; a refusal that raced a change is shown the same way.
export function CompletedClosing({ progress, actions }: ProgressSectionProps & ActionsProps) {
  const reasonId = useId();
  const reason = rerunReasonOf(progress.rerun) ?? actions.rerunRefusal;
  const refused = reason !== undefined;

  return (
    <div className={styles.closing}>
      <p className={styles.closingText}>{CLOSING_NOTE}</p>
      <div className={styles.rerun}>
        <Button
          variant="secondary"
          type="button"
          onClick={refused ? undefined : actions.runAgain}
          aria-disabled={actions.acting || refused}
          aria-describedby={refused ? reasonId : undefined}
        >
          Run it again
        </Button>
        {refused && (
          <p id={reasonId} className={styles.rerunReason}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}
