import { useId } from "react";

import { CardLabel } from "../../atoms/card-label/card-label";
import type { FactRow } from "../../../lib/curation-analysis/view";
import styles from "./counted-facts.module.css";

export interface CountedFactsProps {
  facts: readonly FactRow[];
}

// Numbers counted from the Profile's dates, shown apart from anything the model wrote.
export function CountedFacts({ facts }: CountedFactsProps) {
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} className={styles.panel}>
      <CardLabel id={labelId}>Counted, not guessed</CardLabel>
      <p className={styles.note}>These come straight from your dates. The analysis is given them as facts.</p>
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
