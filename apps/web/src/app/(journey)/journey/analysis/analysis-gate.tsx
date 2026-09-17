import { Button } from "../../../../components/atoms/button/button";
import { LockedEntry } from "../../../../components/molecules/locked-entry/locked-entry";
import { ReviewNotice, type ReviewNoticeProps } from "../../../../components/molecules/review-notice/review-notice";
import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import { jobMatchingLockOf } from "../../../../lib/curation-analysis/view";
import styles from "./analysis.module.css";

export interface AnalysisGateProps {
  notice: ReviewNoticeProps;
  reviewHref: string;
  laterHref: string;
}

// Curating fields the Candidate has not reviewed would anchor Statements in text they are about to correct.
export function AnalysisGate({ notice, reviewHref, laterHref }: AnalysisGateProps) {
  return (
    <div className={styles.gate}>
      <ScreenHeading
        tone="warning"
        eyebrow="Waiting on you"
        title="Confirm your profile to start the analysis"
        lead="The analysis writes statements about your career based on what your profile says. If we run it before you review the extracted fields, it will describe a version of you that you are about to correct."
      />
      <ReviewNotice {...notice} />
      <div className={styles.actions}>
        <Button href={reviewHref}>Review and confirm profile</Button>
        <Button variant="secondary" href={laterHref}>
          Remind me later
        </Button>
      </div>
      <LockedEntry label="Paste a job description" reason={jobMatchingLockOf(false)} />
    </div>
  );
}
