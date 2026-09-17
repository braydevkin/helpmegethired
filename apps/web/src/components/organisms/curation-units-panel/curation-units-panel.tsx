import type { CurationUnitSummary } from "@helpmegethired/shared";
import { useId } from "react";

import { CardLabel } from "../../atoms/card-label/card-label";
import { CurationUnitRow } from "../../molecules/curation-unit-row/curation-unit-row";
import { unitListRowOf } from "../../../lib/curation-analysis/view";
import styles from "./curation-units-panel.module.css";

export interface CurationUnitsPanelProps {
  units: readonly CurationUnitSummary[];
  saved: number;
}

// Every pass in order, named as the Candidate's own history, so the wait reads as a list of what is being read.
export function CurationUnitsPanel({ units, saved }: CurationUnitsPanelProps) {
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} className={styles.panel}>
      <div className={styles.head}>
        <CardLabel id={labelId}>What we are reading</CardLabel>
        <p className={styles.count}>
          {saved} of {units.length} saved
        </p>
      </div>
      <p className={styles.note}>One pass per role, per project, then a look across everything. Each pass is saved on its own, so nothing already done is repeated.</p>
      <ol className={styles.units} aria-label="Every pass">
        {units.map(unitListRowOf).map(({ id, ...row }) => (
          <CurationUnitRow key={id} {...row} />
        ))}
      </ol>
    </section>
  );
}
