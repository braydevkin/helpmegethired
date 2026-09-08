import styles from "./stat-tile.module.css";

export interface StatTileProps {
  value: number;
  label: string;
}

export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <p className={styles.value}>{value}</p>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
