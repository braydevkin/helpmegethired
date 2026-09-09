import { ProfileSection } from "../../molecules/profile-section/profile-section";
import { TimelineEntry } from "../../molecules/timeline-entry/timeline-entry";
import styles from "./education-list.module.css";

export interface EducationEntry {
  id: string;
  title: string;
  institution: string | null;
  period: string | null;
  note: string | null;
}

export interface EducationListProps {
  entries: readonly EducationEntry[];
}

// The academic history in the same timeline as the roles: the degree, where it was taken,
// and when.
export function EducationList({ entries }: EducationListProps) {
  return (
    <ProfileSection title="Education">
      <ul className={styles.entries}>
        {entries.map((entry) => (
          <TimelineEntry key={entry.id} title={entry.title} period={entry.period} subtitle={entry.institution}>
            {entry.note && <p className={styles.note}>{entry.note}</p>}
          </TimelineEntry>
        ))}
      </ul>
    </ProfileSection>
  );
}
