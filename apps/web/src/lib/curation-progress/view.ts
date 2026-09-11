import type {
  CurationFailureReason,
  CurationMetrics,
  CurationPauseReason,
  CurationProgress,
  CurationProgressState,
  CurationStatus,
  CurationUnitFailureReason,
  CurationUnitStatus,
  CurationUnitSummary,
  Duration,
} from "@helpmegethired/shared";

export type UnitState = "done" | "active" | "waiting" | "failed";

// Paused is not a Curation status: a provider rate limit puts the Curation back to `queued`
// with the time it may resume.
export type ProgressPhase = "active" | "paused" | "completed" | "failed" | "cancelled" | "superseded";

export interface UnitRow {
  id: string;
  title: string;
  state: UnitState;
  statusLabel: string;
  detail: string | undefined;
}

export const UNIT_WINDOW_SIZE = 5;

const SETTLED_STATUSES: ReadonlySet<CurationStatus> = new Set(["completed", "failed", "cancelled", "superseded"]);

// Nothing changes on its own once the Curation settles, or while there is none to watch.
export const isSettled = ({ progress }: CurationProgressState): boolean => progress === null || SETTLED_STATUSES.has(progress.status);

export function phaseOf({ status, resumeAfter }: Pick<CurationProgress, "status" | "resumeAfter">): ProgressPhase {
  if (status === "queued" || status === "running") {
    return status === "queued" && resumeAfter !== null ? "paused" : "active";
  }

  return status;
}

const UNIT_STATES: Record<CurationUnitStatus, UnitState> = { saved: "done", running: "active", pending: "waiting", failed: "failed" };
const UNIT_STATUS_LABELS: Record<CurationUnitStatus, string> = { saved: "Saved", running: "Reading", pending: "Waiting", failed: "Failed" };

const NOTHING_SAVED = "nothing was saved for this one.";

const UNIT_FAILURE_DETAILS: Record<CurationUnitFailureReason, string> = {
  timeout: `The model did not answer in time — ${NOTHING_SAVED}`,
  invalid_output: `The model answered in a shape we could not use — ${NOTHING_SAVED}`,
  truncated_response: `The model's answer was cut off before the end — ${NOTHING_SAVED}`,
  provider_error: `Your AI provider returned an error — ${NOTHING_SAVED}`,
};

const unitFailureDetailOf = (reason: CurationUnitFailureReason | null): string =>
  reason === null ? `This pass could not be completed — ${NOTHING_SAVED}` : UNIT_FAILURE_DETAILS[reason];

export const unitRowOf = (unit: CurationUnitSummary): UnitRow => ({
  id: unit.id,
  title: unit.title,
  state: UNIT_STATES[unit.status],
  statusLabel: UNIT_STATUS_LABELS[unit.status],
  detail: unit.status === "failed" ? unitFailureDetailOf(unit.failureReason) : undefined,
});

// Three units run at once, so the pass named is the first one running, else the next one to
// run, else the first that failed.
export function focusIndexOf(units: readonly CurationUnitSummary[]): number {
  for (const status of ["running", "pending", "failed"] as const) {
    const index = units.findIndex((unit) => unit.status === status);

    if (index >= 0) {
      return index;
    }
  }

  return Math.max(0, units.length - 1);
}

// The saved pass just before the focused one stays in view, so the list reads as history.
export function unitWindowOf<Unit>(units: readonly Unit[], focus: number, size = UNIT_WINDOW_SIZE): Unit[] {
  const start = Math.min(Math.max(0, focus - 1), Math.max(0, units.length - size));

  return units.slice(start, start + size);
}

export function passLabelOf(progress: CurationProgress): string {
  const { total, saved, list } = progress.units;
  const focus = focusIndexOf(list);
  const focused = list[focus];

  switch (phaseOf(progress)) {
    case "active":
    case "paused":
      if (!focused) {
        return `${total} passes to read`;
      }

      return `${focused.status === "running" ? "Pass" : "Next: pass"} ${focus + 1} of ${total} · ${focused.title}`;
    case "completed":
      return `All ${total} passes saved`;
    case "failed":
    case "cancelled":
      return `Stopped after ${saved} of ${total} passes`;
    case "superseded":
      return `${saved} of ${total} passes were saved`;
  }
}

const RUN_FAILURE_LEADS: Record<CurationFailureReason, string> = {
  attempts_exhausted: "Everything finished before the failure is saved and will not be redone. Trying again picks up exactly where it stopped.",
  model_key_rejected: "Your AI provider refused the key saved on your Account, so nothing more could be read. Everything already saved is kept.",
};

const PAUSED_HEADINGS: Record<CurationPauseReason, { title: string; lead: string }> = {
  provider_rate_limit: { title: "Paused for a moment", lead: "Your AI provider asked us to slow down. Reading picks up again on its own." },
  embedding_ceiling: {
    title: "Paused until the allowance resets",
    lead: "Your account has used its daily analysis allowance. Everything saved is kept, and the analysis finishes on its own.",
  },
};

// The allowance resets at midnight UTC, which is often another day where the Candidate lives, so
// that notice carries the date as well as the time.
export function pausedNoticeOf({ pauseReason }: Pick<CurationProgress, "pauseReason">): { lead: string; withDate: boolean } {
  return pauseReason === "embedding_ceiling"
    ? { lead: "Your account reached its daily analysis allowance. Resumes on", withDate: true }
    : { lead: "Paused by your AI provider. Resumes at", withDate: false };
}

export function headingOf(progress: CurationProgress): { title: string; lead: string } {
  switch (phaseOf(progress)) {
    case "active":
      return { title: "Understanding what you have done", lead: "We read one role or project at a time and write down what it proves about you." };
    case "paused":
      return PAUSED_HEADINGS[progress.pauseReason ?? "provider_rate_limit"];
    case "completed":
      return { title: "All passes saved and indexed", lead: "Ready for job matching." };
    case "failed":
      return { title: "The analysis stopped partway", lead: RUN_FAILURE_LEADS[progress.failureReason ?? "attempts_exhausted"] };
    case "cancelled":
      return { title: "You stopped the analysis", lead: "Everything saved before you stopped it is kept." };
    case "superseded":
      return { title: "A newer résumé replaced this analysis", lead: "Confirm the new profile and its analysis starts on its own." };
  }
}

const WAITING_FOOTNOTE = "Safe to close this tab — progress counts passes actually saved, so it reads the same when you come back.";
const STOPPED_FOOTNOTE = "Nothing is lost. Your profile is untouched and every saved pass is kept.";

export function footnoteOf(progress: CurationProgress): string | undefined {
  switch (phaseOf(progress)) {
    case "active":
    case "paused":
      return WAITING_FOOTNOTE;
    case "failed":
    case "cancelled":
      return STOPPED_FOOTNOTE;
    case "completed":
    case "superseded":
      return undefined;
  }
}

export function durationLabelOf({ years, months }: Duration): string {
  const parts = [years > 0 ? `${years} yr` : undefined, months > 0 ? `${months} mo` : undefined].filter((part) => part !== undefined);

  return parts.length > 0 ? parts.join(" ") : "Under a month";
}

const counted = (count: number, singular: string, plural: string): string => `${count} ${count === 1 ? singular : plural}`;

// The facts the model was given, never figures it produced.
export function metricChipsOf({ careerDuration, counts }: CurationMetrics): string[] {
  const career = careerDuration.years > 0 || careerDuration.months > 0 ? `${durationLabelOf(careerDuration)} career` : undefined;
  const roles = counts.roles > 0 ? counted(counts.roles, "role", "roles") : undefined;
  const projects = counts.projects > 0 ? counted(counts.projects, "project", "projects") : undefined;

  return [career, roles, projects].filter((chip) => chip !== undefined);
}
