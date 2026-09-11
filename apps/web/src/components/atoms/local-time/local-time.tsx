"use client";

import { useSyncExternalStore } from "react";

const HOUR_AND_MINUTE = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY_AND_TIME = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const subscribeToNothing = () => () => {};

export interface LocalTimeProps {
  dateTime: string;
  withDate?: boolean;
}

// The server cannot know the Candidate's time zone, so the time is written only once the page runs in their browser.
export function LocalTime({ dateTime, withDate = false }: LocalTimeProps) {
  const inBrowser = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const format = withDate ? DAY_AND_TIME : HOUR_AND_MINUTE;

  return <time dateTime={dateTime}>{inBrowser ? format.format(new Date(dateTime)) : null}</time>;
}
