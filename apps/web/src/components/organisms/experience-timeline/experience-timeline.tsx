import { Fragment, type ReactNode } from "react";

import { Badge } from "../../atoms/badge/badge";
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
  corrected: boolean;
  skills: readonly string[];
}

export interface ExperienceTimelineProps {
  entries: readonly ExperienceEntry[];
  meta: string | null;
  entryActions?: (entry: ExperienceEntry) => ReactNode;
  entryForm?: (entry: ExperienceEntry) => ReactNode;
  footer?: ReactNode;
}

export const CORRECTED_LABEL = "Corrected by you";

// The work history as a timeline, each role with what it was about, the skills it used, and
// whatever the Ingestion could not read with confidence. An entry being corrected gives its
// place to the form that corrects it.
export function ExperienceTimeline({ entries, meta, entryActions, entryForm, footer }: ExperienceTimelineProps) {
  return (
    <ProfileSection title="Experience" meta={meta ?? undefined}>
      <ul className={styles.entries}>
        {entries.map((entry) => {
          const form = entryForm?.(entry);

          return form ? (
            <Fragment key={entry.id}>{form}</Fragment>
          ) : (
            <TimelineEntry key={entry.id} title={entry.role} period={entry.period} subtitle={entry.company}>
              {entry.corrected && <Badge className={styles.corrected}>{CORRECTED_LABEL}</Badge>}
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
              {entryActions?.(entry)}
            </TimelineEntry>
          );
        })}
      </ul>
      {footer}
    </ProfileSection>
  );
}
