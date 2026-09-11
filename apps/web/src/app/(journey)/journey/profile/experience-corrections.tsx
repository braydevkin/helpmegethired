"use client";

import type { Experience } from "@helpmegethired/shared";
import { useState, useTransition } from "react";

import { Button } from "../../../../components/atoms/button/button";
import { ErrorMessage } from "../../../../components/atoms/error-message/error-message";
import type { CorrectionAction, CorrectionResult } from "../../../../lib/profile/correction-form";
import { ExperienceTimeline, type ExperienceEntry } from "../../../../components/organisms/experience-timeline/experience-timeline";
import { ExperienceForm, type ExperienceFormValues } from "./experience-form";
import styles from "./experience-corrections.module.css";

export interface ExperienceCorrectionsProps {
  entries: readonly ExperienceEntry[];
  experiences: readonly Experience[];
  meta: string | null;
  editable: boolean;
  save: CorrectionAction;
  remove: (entryId: string) => Promise<CorrectionResult>;
}

const NEW_ENTRY = "new";

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

// The Experience timeline with the Candidate's corrections on it: one entry open at a time,
// a role they can add, and a role they can take out.
export function ExperienceCorrections({ entries, experiences, meta, editable, save, remove }: ExperienceCorrectionsProps) {
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();

  const close = () => setOpenEntry(null);

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

        return editable && openEntry === entry.id && experience ? (
          <ExperienceForm values={valuesOf(experience)} legend={`Correcting ${experience.role}`} save={save} onSaved={close} onCancel={close} />
        ) : undefined;
      }}
      entryActions={(entry) =>
        editable &&
        openEntry === null && (
          <div className={styles.actions}>
            <Button variant="secondary" type="button" className={styles.action} onClick={() => setOpenEntry(entry.id)}>
              Correct this role
            </Button>
            <Button variant="secondary" type="button" className={styles.action} disabled={removing} onClick={() => removeEntry(entry.id)}>
              Remove
            </Button>
          </div>
        )
      }
      footer={
        editable && (
          <div className={styles.footer}>
            {openEntry === NEW_ENTRY ? (
              <ul className={styles.entries}>
                <ExperienceForm values={EMPTY_VALUES} legend="A role your résumé missed" save={save} onSaved={close} onCancel={close} />
              </ul>
            ) : (
              openEntry === null && (
                <Button variant="secondary" type="button" className={styles.action} onClick={() => setOpenEntry(NEW_ENTRY)}>
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
