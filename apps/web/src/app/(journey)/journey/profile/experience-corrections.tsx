"use client";

import type { Experience } from "@helpmegethired/shared";
import { useState, useTransition } from "react";

import { Button } from "../../../../components/atoms/button/button";
import { ErrorMessage } from "../../../../components/atoms/error-message/error-message";
import type { CorrectionAction, CorrectionResult } from "../../../../lib/profile/correction-form";
import { ExperienceTimeline, type ExperienceEntry } from "../../../../components/organisms/experience-timeline/experience-timeline";
import { ExperienceForm, type ExperienceFormValues } from "./experience-form";
import styles from "./experience-corrections.module.css";
import { useProfileEditing } from "./profile-editing";

export interface ExperienceCorrectionsProps {
  entries: readonly ExperienceEntry[];
  experiences: readonly Experience[];
  meta: string | null;
  editable: boolean;
  save: CorrectionAction;
  remove: (entryId: string) => Promise<CorrectionResult>;
}

const NEW_ENTRY = "new-experience";

const EMPTY_VALUES: ExperienceFormValues = { id: null, role: "", company: "", periodStart: "", periodEnd: "", description: "", skills: "" };

// The timeline writes the period for reading; the form asks for the months the Experience
// actually carries, which is why it corrects the Experience and not what is on screen.
const valuesOf = (experience: Experience): ExperienceFormValues => ({
  id: experience.id,
  role: experience.role,
  company: experience.company ?? "",
  periodStart: experience.period?.start ?? "",
  periodEnd: experience.period?.end ?? "",
  description: experience.description ?? "",
  skills: experience.skills.join(", "),
});

// The Experience timeline with the Candidate's corrections on it: a role to correct, a role
// they can add, and a role they can take out. Every button names the role it acts on, since a
// screen reader lists them apart from the entry they sit in.
export function ExperienceCorrections({ entries, experiences, meta, editable, save, remove }: ExperienceCorrectionsProps) {
  const editing = useProfileEditing();
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();
  const offered = editable && editing.openEditor === null;

  const open = (editor: string) => {
    setFailure(null);
    editing.open(editor);
  };

  const removeEntry = (entryId: string) => {
    setFailure(null);
    startRemoving(async () => {
      const outcome = await remove(entryId);

      setFailure(outcome.ok ? null : outcome.message);
    });
  };

  return (
    <ExperienceTimeline
      entries={entries}
      meta={meta}
      entryForm={(entry) => {
        const experience = experiences.find((candidate) => candidate.id === entry.id);

        return editable && editing.openEditor === entry.id && experience ? (
          <ExperienceForm values={valuesOf(experience)} legend={`Correcting ${experience.role}`} save={save} onSaved={editing.close} onCancel={editing.close} />
        ) : undefined;
      }}
      entryActions={(entry) =>
        offered && (
          <div className={styles.actions}>
            <Button
              ref={editing.returnFocusTo(entry.id)}
              variant="secondary"
              type="button"
              className={styles.action}
              aria-label={`Correct this role: ${entry.role}`}
              disabled={removing}
              onClick={() => open(entry.id)}
            >
              Correct this role
            </Button>
            <Button
              variant="secondary"
              type="button"
              className={styles.action}
              aria-label={`Remove ${entry.role}`}
              disabled={removing}
              onClick={() => removeEntry(entry.id)}
            >
              Remove
            </Button>
          </div>
        )
      }
      footer={
        editable && (
          <div className={styles.footer}>
            {entries.length === 0 && <p className={styles.empty}>Your résumé listed no roles.</p>}
            {editing.openEditor === NEW_ENTRY ? (
              <ul className={styles.entries}>
                <ExperienceForm values={EMPTY_VALUES} legend="A role your résumé missed" save={save} onSaved={editing.close} onCancel={editing.close} />
              </ul>
            ) : (
              offered && (
                <Button
                  ref={editing.returnFocusTo(NEW_ENTRY)}
                  variant="secondary"
                  type="button"
                  className={styles.action}
                  disabled={removing}
                  onClick={() => open(NEW_ENTRY)}
                >
                  Add a role
                </Button>
              )
            )}
            {failure && <ErrorMessage>{failure}</ErrorMessage>}
          </div>
        )
      }
    />
  );
}
