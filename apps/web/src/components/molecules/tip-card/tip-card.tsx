import styles from "./tip-card.module.css";

export interface TipCardProps {
  title: string;
  body: string;
}

export function TipCard({ title, body }: TipCardProps) {
  return (
    <div className={styles.card}>
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
    </div>
  );
}
