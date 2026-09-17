"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import type { ActionFailure } from "../../../lib/with-session";
import { Button } from "../../atoms/button/button";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import styles from "./model-reading-offer.module.css";

export interface ModelReadingOfferProps {
  fileName: string | null;
  start: () => Promise<ActionFailure>;
}

// Reading again throws away what the Candidate already did on this Profile and spends their tokens,
// so the offer opens a confirmation that says so before anything starts.
export function ModelReadingOffer({ fileName, start }: ModelReadingOfferProps) {
  const [confirming, setConfirming] = useState(false);
  const titleId = useId();
  const source = fileName ?? "your résumé";

  if (confirming) {
    return <ReadingConfirmation source={source} start={start} onKeep={() => setConfirming(false)} />;
  }

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.title}>
        Your AI can read your résumé again
      </h2>
      <p className={styles.body}>We kept the text of {source}. Your AI can read it again and rebuild this profile from it.</p>
      <div className={styles.actions}>
        <Button variant="secondary" type="button" onClick={() => setConfirming(true)}>
          Read my résumé again with your AI
        </Button>
      </div>
    </section>
  );
}

interface ReadingConfirmationProps {
  source: string;
  start: () => Promise<ActionFailure>;
  onKeep: () => void;
}

function ReadingConfirmation({ source, start, onKeep }: ReadingConfirmationProps) {
  const [failure, submit, starting] = useActionState(async (): Promise<ActionFailure> => start(), null);
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus();
  }, []);

  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} ref={title} tabIndex={-1} className={styles.title}>
        Rebuild your profile with your AI?
      </h2>
      <ul className={styles.consequences}>
        <li>Your AI rebuilds this profile from the text of {source}.</li>
        <li>The corrections you made here are replaced, and you confirm the new profile again.</li>
        <li>A finished analysis of your profile is replaced too.</li>
        <li>It runs on your API key, so your provider counts the tokens it uses.</li>
      </ul>
      <form action={submit} className={styles.actions}>
        <Button type="submit" disabled={starting}>
          Read it again
        </Button>
        <Button variant="secondary" type="button" disabled={starting} onClick={onKeep}>
          Keep my profile
        </Button>
      </form>
      {failure && <ErrorMessage className={styles.failure}>{failure.message}</ErrorMessage>}
    </section>
  );
}
