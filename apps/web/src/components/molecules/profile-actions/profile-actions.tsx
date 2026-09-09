"use client";

import { useActionState } from "react";

import { Button } from "../../atoms/button/button";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import styles from "./profile-actions.module.css";

export type ConfirmResult = { ok: true } | { ok: false; message: string };

export interface ProfileActionsProps {
  uploadHref: string;
  confirmed: boolean;
  confirm: () => Promise<ConfirmResult>;
}

const CONFIRMED_LABEL = "Profile confirmed · the LinkedIn step is next";

// The two actions the review offers. Once the Profile is confirmed the journey has moved
// on, so only the way back to a new upload remains.
export function ProfileActions({ uploadHref, confirmed, confirm }: ProfileActionsProps) {
  const [result, submit, confirming] = useActionState(async (): Promise<ConfirmResult> => confirm(), null);

  return (
    <>
      <Button variant="secondary" size="header" href={uploadHref}>
        Re-upload PDF
      </Button>
      {confirmed ? (
        <p className={styles.confirmed}>{CONFIRMED_LABEL}</p>
      ) : (
        <form action={submit}>
          <Button size="header" type="submit" disabled={confirming}>
            Confirm profile
          </Button>
        </form>
      )}
      {result?.ok === false && <ErrorMessage className={styles.failure}>{result.message}</ErrorMessage>}
    </>
  );
}
