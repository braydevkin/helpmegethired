import type { StatementReviewState } from "@helpmegethired/shared";
import { useId } from "react";

import { classNames } from "../../../lib/class-names";
import { Button } from "../../atoms/button/button";
import { Chip } from "../../atoms/chip/chip";
import styles from "./statement-card.module.css";

export interface StatementCardProps {
  text: string;
  labels: readonly string[];
  quotes: readonly { id: string; text: string }[];
  source: string;
  review: StatementReviewState;
  saving: boolean;
  onReview: (state: StatementReviewState) => void;
}

// Pressing the chosen answer again takes it back, so a mistaken reject is one keypress from undone.
const nextStateOf = (current: StatementReviewState, pressed: "accepted" | "rejected"): StatementReviewState => (current === pressed ? "unreviewed" : pressed);

// The buttons stay enabled while a review saves, so keyboard focus is never dropped; a second
// press is ignored until the first answer is back.
export function StatementCard({ text, labels, quotes, source, review, saving, onReview }: StatementCardProps) {
  const textId = useId();
  const rejected = review === "rejected";
  const answer = (pressed: "accepted" | "rejected") => () => {
    if (!saving) {
      onReview(nextStateOf(review, pressed));
    }
  };

  return (
    <article aria-labelledby={textId} aria-busy={saving} className={classNames(styles.card, rejected && styles.rejected)} data-review={review}>
      <StatementLabels labels={labels} />
      <p id={textId} className={styles.text}>
        {text}
      </p>
      <StatementEvidence quotes={quotes} source={source} />
      {rejected && <p className={styles.excluded}>Rejected · not used to match you to a job</p>}
      <div className={styles.actions} role="group" aria-label="Your review">
        <Button variant="secondary" type="button" aria-pressed={review === "accepted"} aria-disabled={saving} onClick={answer("accepted")}>
          Looks right
        </Button>
        <Button variant="secondary" type="button" aria-pressed={rejected} aria-disabled={saving} onClick={answer("rejected")}>
          Reject
        </Button>
      </div>
    </article>
  );
}

function StatementLabels({ labels }: Pick<StatementCardProps, "labels">) {
  if (labels.length === 0) {
    return null;
  }

  return (
    <ul className={styles.labels} aria-label="Labels">
      {labels.map((label) => (
        <li key={label}>
          <Chip compact>{label}</Chip>
        </li>
      ))}
    </ul>
  );
}

function StatementEvidence({ quotes, source }: Pick<StatementCardProps, "quotes" | "source">) {
  return (
    <figure className={styles.evidence}>
      <figcaption className={styles.evidenceLabel}>From your résumé</figcaption>
      {quotes.map((quote) => (
        <blockquote key={quote.id} className={styles.quote}>
          “{quote.text}”
        </blockquote>
      ))}
      <p className={styles.source}>{source}</p>
    </figure>
  );
}
