"use client";

import { useActionState, useId } from "react";

import { Button } from "../../atoms/button/button";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import styles from "./profile-actions.module.css";

export type ConfirmResult = { ok: true } | { ok: false; message: string };

export interface ProfileActionsProps {
  uploadHref: string;
  analysisHref: string;
  confirmed: boolean;
  correcting: boolean;
  confirm: () => Promise<ConfirmResult>;
}

// The two actions the review offers. Once the Profile is confirmed the journey has moved
// on to the analysis, so the way there takes the confirmation's place. A correction still open
// holds the confirmation back, since confirming would drop what the Candidate is typing.
export function ProfileActions({ uploadHref, analysisHref, confirmed, correcting, confirm }: ProfileActionsProps) {
  const [result, submit, confirming] = useActionState(async (): Promise<ConfirmResult> => confirm(), null);
  const heldId = useId();

  return (
    <>
      <Button variant="secondary" size="header" href={uploadHref}>
        Re-upload PDF
      </Button>
      {confirmed ? (
        <>
          <p className={styles.confirmed}>Profile confirmed</p>
          <Button size="header" href={analysisHref}>
            Open the analysis
          </Button>
          <p className={styles.note}>Your Profile takes no more corrections: the analysis reads it as you confirmed it.</p>
        </>
      ) : (
        <>
          <form action={submit}>
            <Button size="header" type="submit" disabled={confirming || correcting} aria-describedby={correcting ? heldId : undefined}>
              Confirm profile
            </Button>
          </form>
          {correcting && (
            <p id={heldId} className={styles.note}>
              Save or cancel your correction before confirming.
            </p>
          )}
        </>
      )}
      {result?.ok === false && <ErrorMessage className={styles.failure}>{result.message}</ErrorMessage>}
    </>
  );
}
