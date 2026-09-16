import type { ReactNode } from "react";

import { CORRECTED_LABEL } from "../../../lib/profile/corrected-label";
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

type ExperienceTimelineItemProps = Pick<ExperienceTimelineProps, "entryActions" | "entryForm"> & { entry: ExperienceEntry };

function EntryDescription({ description, note }: Pick<ExperienceEntry, "description" | "note">) {
  if (!description && !note) {
    return null;
  }

  return (
    <p className={styles.description}>
      {description}
      {description && note && " "}
      {note && <span className={styles.note}>{note}</span>}
    </p>
  );
}

function EntrySkills({ skills }: Pick<ExperienceEntry, "skills">) {
  if (skills.length === 0) {
    return null;
  }

  return (
    <ul className={styles.skills}>
      {skills.map((skill) => (
        <li key={skill}>
          <Chip compact>{skill}</Chip>
        </li>
      ))}
    </ul>
  );
}

// An entry being corrected gives its place to the form that corrects it.
function ExperienceTimelineItem({ entry, entryActions, entryForm }: ExperienceTimelineItemProps) {
  const form = entryForm?.(entry);

  if (form) {
    return form;
  }

  return (
    <TimelineEntry title={entry.role} period={entry.period} subtitle={entry.company}>
      {entry.corrected && <Badge className={styles.corrected}>{CORRECTED_LABEL}</Badge>}
      <EntryDescription description={entry.description} note={entry.note} />
      <EntrySkills skills={entry.skills} />
      {entryActions?.(entry)}
    </TimelineEntry>
  );
}

// The work history as a timeline, each role with what it was about, the skills it used, and
// whatever the Ingestion could not read with confidence.
export function ExperienceTimeline({ entries, meta, entryActions, entryForm, footer }: ExperienceTimelineProps) {
  return (
    <ProfileSection title="Experience" meta={meta ?? undefined}>
      <ul className={styles.entries}>
        {entries.map((entry) => (
          <ExperienceTimelineItem key={entry.id} entry={entry} entryActions={entryActions} entryForm={entryForm} />
        ))}
      </ul>
      {footer}
    </ProfileSection>
  );
}
