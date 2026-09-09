import { Button } from "../../atoms/button/button";
import styles from "./done-card.module.css";

export interface DoneCardProps {
  name: string;
  journeyHref: string;
}

export function DoneCard({ name, journeyHref }: DoneCardProps) {
  return (
    <div className={styles.card}>
      <div aria-hidden="true" className={styles.mark}>
        ✓
      </div>
      <h1 className={styles.title}>You&apos;re in, {name}</h1>
      <p className={styles.lead}>
        Your account is ready. Next up: upload your résumé and we&apos;ll build your Profile from it.
      </p>
      <Button href={journeyHref}>Go to my dashboard</Button>
    </div>
  );
}
