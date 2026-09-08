import { Chip } from "../../atoms/chip/chip";
import { ProfileSection } from "../../molecules/profile-section/profile-section";
import { TimelineEntry } from "../../molecules/timeline-entry/timeline-entry";
import styles from "./experience-timeline.module.css";

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string | null;
  period: string | null;
  description: string | null;
  note: string | null;
  skills: readonly string[];
}

export interface ExperienceTimelineProps {
  entries: readonly ExperienceEntry[];
  meta: string | null;
}

// The work history as a timeline, each role with what it was about, the skills it used,
// and whatever the Ingestion could not read with confidence.
export function ExperienceTimeline({ entries, meta }: ExperienceTimelineProps) {
  return (
    <ProfileSection title="Experience" meta={meta ?? undefined}>
      <ul className={styles.entries}>
        {entries.map((entry) => (
          <TimelineEntry key={entry.id} title={entry.role} period={entry.period} subtitle={entry.company}>
            {(entry.description || entry.note) && (
              <p className={styles.description}>
                {entry.description}
                {entry.description && entry.note && " "}
                {entry.note && <span className={styles.note}>{entry.note}</span>}
              </p>
            )}
            {entry.skills.length > 0 && (
              <ul className={styles.skills}>
                {entry.skills.map((skill) => (
                  <li key={skill}>
                    <Chip compact>{skill}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </TimelineEntry>
        ))}
      </ul>
    </ProfileSection>
  );
}
