"use client";

import { useEffect, useState } from "react";

import styles from "./resend-countdown.module.css";

export interface ResendCountdownProps {
  sentAt: number;
  onResend: () => void;
  seconds?: number;
  disabled?: boolean;
}

const DEFAULT_SECONDS = 60;
const TICK_MILLISECONDS = 1000;

const remainingSeconds = (sentAt: number, seconds: number) =>
  Math.max(0, seconds - Math.floor((Date.now() - sentAt) / TICK_MILLISECONDS));

const formatClock = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

export function ResendCountdown({ sentAt, onResend, seconds = DEFAULT_SECONDS, disabled = false }: ResendCountdownProps) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(sentAt, seconds));
  const [countedFrom, setCountedFrom] = useState(sentAt);

  if (countedFrom !== sentAt) {
    setCountedFrom(sentAt);
    setRemaining(remainingSeconds(sentAt, seconds));
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const next = remainingSeconds(sentAt, seconds);

      setRemaining(next);

      if (next === 0) {
        clearInterval(timer);
      }
    }, TICK_MILLISECONDS);

    return () => clearInterval(timer);
  }, [sentAt, seconds]);

  if (remaining > 0) {
    // The code step can be server-rendered from the pending email cookie, and the
    // seconds left differ between that render and hydration by design.
    return (
      <span className={styles.countdown} aria-live="off" suppressHydrationWarning>
        Resend in {formatClock(remaining)}
      </span>
    );
  }

  return (
    <button type="button" className={styles.resend} onClick={onResend} disabled={disabled}>
      Resend code
    </button>
  );
}
