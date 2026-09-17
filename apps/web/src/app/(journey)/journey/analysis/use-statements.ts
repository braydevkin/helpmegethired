import type { CuratedStatement, CurationStatements, StatementReviewState } from "@helpmegethired/shared";
import { useEffect, useState, useTransition } from "react";

import { readStatementsAction, reviewStatementAction } from "./actions";

export interface ReviewableStatements {
  statements: readonly CuratedStatement[];
  reviewing: string | undefined;
  message: string | undefined;
  review: (id: string, next: StatementReviewState) => void;
}

const withReviewed = (current: CurationStatements, reviewed: CuratedStatement): CurationStatements => ({
  ...current,
  statements: current.statements.map((statement) => (statement.id === reviewed.id ? reviewed : statement)),
});

// A run that completes while the page is open wrote Statements the page has not read yet, so
// they are read once for that Curation.
export function useStatements(initial: CurationStatements, completedCurationId: string | null): ReviewableStatements {
  const [current, setCurrent] = useState(initial);
  const [reviewing, setReviewing] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [, startReview] = useTransition();

  useEffect(() => {
    if (completedCurationId === null || completedCurationId === current.curationId) {
      return;
    }

    let cancelled = false;

    void readStatementsAction().then((result) => {
      if (!cancelled && result.ok) {
        setCurrent(result.value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [completedCurationId, current.curationId]);

  const review = (id: string, next: StatementReviewState) => {
    setReviewing(id);
    setMessage(undefined);
    startReview(async () => {
      const result = await reviewStatementAction(id, next);

      setReviewing(undefined);

      if (result.ok) {
        setCurrent((statements) => withReviewed(statements, result.value));
      } else {
        setMessage(result.message);
      }
    });
  };

  return { statements: current.statements, reviewing, message, review };
}
