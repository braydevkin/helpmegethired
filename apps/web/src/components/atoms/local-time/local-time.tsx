"use client";

import { useSyncExternalStore } from "react";

const HOUR_AND_MINUTE = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const subscribeToNothing = () => () => {};

export interface LocalTimeProps {
  dateTime: string;
}

// The server cannot know the Candidate's time zone, so the time is written only once the page runs in their browser.
export function LocalTime({ dateTime }: LocalTimeProps) {
  const inBrowser = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  return <time dateTime={dateTime}>{inBrowser ? HOUR_AND_MINUTE.format(new Date(dateTime)) : null}</time>;
}
