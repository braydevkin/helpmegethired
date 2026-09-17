import { useId } from "react";

import { CardLabel } from "../../atoms/card-label/card-label";
import { LocalTime } from "../../atoms/local-time/local-time";
import type { RunDetails as RunDetailsView } from "../../../lib/curation-analysis/view";
import styles from "./run-details.module.css";

export type RunDetailsProps = RunDetailsView;

export function RunDetails({ basedOn, confirmedAt, passes, readingWith }: RunDetailsProps) {
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} className={styles.panel}>
      <CardLabel id={labelId}>Run details</CardLabel>
      <dl className={styles.details}>
        {basedOn && (
          <div>
            <dt>Based on</dt>
            <dd>{basedOn}</dd>
          </div>
        )}
        {confirmedAt && (
          <div>
            <dt>Confirmed</dt>
            <dd>
              <LocalTime dateTime={confirmedAt} withDate />
            </dd>
          </div>
        )}
        <div>
          <dt>Passes</dt>
          <dd>{passes}</dd>
        </div>
        <div>
          <dt>Reading with</dt>
          <dd>{readingWith}</dd>
        </div>
      </dl>
    </section>
  );
}
