import { Badge } from "../../atoms/badge/badge";
import styles from "./choice-card.module.css";

export interface ChoiceCardProps {
  name: string;
  detail: string;
  badge: string;
  mark?: string;
}

// The option in effect, shown as chosen rather than as a radio: phase one offers one of each.
export function ChoiceCard({ name, detail, badge, mark }: ChoiceCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        {mark && (
          <span aria-hidden="true" className={styles.mark}>
            {mark}
          </span>
        )}
        <p className={styles.name}>{name}</p>
        <Badge>{badge}</Badge>
      </div>
      <p className={styles.detail}>{detail}</p>
    </div>
  );
}
