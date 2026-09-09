import { StatTile, type StatTileProps } from "../../atoms/stat-tile/stat-tile";
import styles from "./profile-stats.module.css";

export interface ProfileStatsProps {
  stats: readonly StatTileProps[];
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  return (
    <div aria-label="Profile at a glance" role="group" className={styles.stats}>
      {stats.map((stat) => (
        <StatTile key={stat.label} {...stat} />
      ))}
    </div>
  );
}
