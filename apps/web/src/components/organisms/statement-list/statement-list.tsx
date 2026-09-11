import type { CuratedStatement, StatementReviewState } from "@helpmegethired/shared";
import { useId } from "react";

import { StatementCard } from "../../molecules/statement-card/statement-card";
import { statementCardOf } from "../../../lib/curation-analysis/view";
import styles from "./statement-list.module.css";

export interface StatementListProps {
  statements: readonly CuratedStatement[];
  summary: string;
  note?: string | undefined;
  reviewing?: string | undefined;
  onReview: (id: string, state: StatementReviewState) => void;
}

export function StatementList({ statements, summary, note, reviewing, onReview }: StatementListProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={styles.panel}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          What the analysis found
        </h2>
        <p className={styles.summary}>{summary}</p>
      </div>
      <p className={styles.note}>
        Each statement quotes the line in your résumé it came from. If a quote looks wrong to you, reject it — nothing you reject is used to match you to a job.
      </p>
      {note && <p className={styles.previous}>{note}</p>}
      {statements.length > 0 ? (
        <ul className={styles.list}>
          {statements.map(statementCardOf).map(({ id, ...card }) => (
            <li key={id}>
              <StatementCard {...card} saving={reviewing === id} onReview={(state) => onReview(id, state)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>The analysis found nothing it could quote from your résumé.</p>
      )}
    </section>
  );
}
