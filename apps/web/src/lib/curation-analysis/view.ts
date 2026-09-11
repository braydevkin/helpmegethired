import {
  MODEL_CATALOGUE,
  type CompanyDuration,
  type CuratedStatement,
  type CurationActionErrorCode,
  type CurationMetrics,
  type CurationProgress,
  type CurationUnitKind,
  type CurationUnitSummary,
  type Duration,
  type ReviewFlag,
  type StatementReviewState,
} from "@helpmegethired/shared";

import { durationLabelOf, headingOf, phaseOf, unitRowOf, type UnitRow } from "../curation-progress/view";
import { reviewSummaryOf } from "../profile/review";

export type HeadingTone = "brand" | "warning" | "error";

export interface PageHeading {
  eyebrow: string;
  title: string;
  lead: string;
  tone: HeadingTone;
}

export interface GateNotice {
  title: string;
  detail: string;
}

export interface FactRow {
  label: string;
  value: string;
}

export interface RunSource {
  basedOn: string | null;
  confirmedAt: string | null;
}

export interface RunDetails extends RunSource {
  passes: string;
  readingWith: string;
}

export interface FailureSummary {
  title: string;
  subject: string | undefined;
  reason: string;
  needsNewKey: boolean;
}

export interface StatementCardView {
  id: string;
  text: string;
  labels: string[];
  quotes: { id: string; text: string }[];
  source: string;
  review: StatementReviewState;
}

const READING_LEAD = "We read your roles and projects one at a time and write down what each one proves about you. This runs once — every job you paste later reuses it.";

const UNIT_KIND_LABELS: Record<CurationUnitKind, string> = { experience: "Role", project: "Project", cross_cutting: "Across all", synthesis: "Summary" };

const WHOLE_PROFILE_SOURCES: Partial<Record<CurationUnitKind, string>> = { cross_cutting: "Across all roles and projects", synthesis: "Your overall picture" };

const REFUSALS: Record<CurationActionErrorCode, string> = {
  curation_active: "An analysis is already running. Wait for it to finish, or stop it first.",
  curation_not_found: "There is no analysis running to stop.",
  curation_not_ready: "Confirm your profile and choose your AI before starting the analysis.",
  curation_not_retryable: "This analysis can't be picked up where it stopped. Run it again instead.",
  curation_model_changed: "Your AI changed since this analysis started, so it can't be picked up where it stopped. Run it again with the AI you chose.",
  curation_unchanged: "Nothing has changed since this analysis ran: the same profile and the same AI would write the same statements.",
};

function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function gateNoticeOf(flags: readonly ReviewFlag[]): GateNotice {
  if (flags.length === 0) {
    return { title: "Nothing was flagged", detail: "Look your profile over and confirm it to move on to the analysis." };
  }

  const subject = flags.length === 1 ? "1 field still needs" : `${flags.length} fields still need`;

  return { title: `${subject} a decision`, detail: `${reviewSummaryOf(flags)}. Fix or accept them, then confirm your profile to move on to the analysis.` };
}

export function pageHeadingOf(progress: CurationProgress): PageHeading {
  switch (phaseOf(progress)) {
    case "active":
    case "paused":
      return { eyebrow: "Reading your profile", title: "Understanding what you have done", lead: READING_LEAD, tone: "brand" };
    case "completed":
      return {
        eyebrow: "Analysis complete",
        title: "We know your profile now",
        lead: `${counted(progress.units.total, "pass", "passes")} over your profile, each one saved with the line it came from. Review anything that reads wrong before you match your first job.`,
        tone: "brand",
      };
    case "failed":
      return { eyebrow: "Stopped", ...headingOf(progress), tone: "error" };
    case "cancelled":
      return {
        eyebrow: "Stopped",
        title: "You stopped the analysis",
        lead: "Everything saved before you stopped it is kept. Trying again picks up exactly where it stopped.",
        tone: "error",
      };
    case "superseded":
      return { eyebrow: "Replaced", ...headingOf(progress), tone: "warning" };
  }
}

export function unitListRowOf(unit: CurationUnitSummary): UnitRow & { kindLabel: string } {
  return { ...unitRowOf(unit), kindLabel: UNIT_KIND_LABELS[unit.kind] };
}

function monthsOf({ years, months }: Duration): number {
  return years * 12 + months;
}

function longestTenureOf(companies: readonly CompanyDuration[]): CompanyDuration | undefined {
  let longest: CompanyDuration | undefined;

  for (const company of companies) {
    if (!longest || monthsOf(company.duration) > monthsOf(longest.duration)) {
      longest = company;
    }
  }

  return longest;
}

// The facts the model was given, never figures it produced.
export function countedFactsOf({ careerDuration, durationPerCompany, counts }: CurationMetrics): FactRow[] {
  const longest = longestTenureOf(durationPerCompany);

  return [
    { label: "Career length", value: durationLabelOf(careerDuration) },
    ...(longest ? [{ label: "Longest tenure", value: `${longest.company}, ${durationLabelOf(longest.duration)}` }] : []),
    { label: "Roles", value: String(counts.roles) },
    { label: "Projects", value: String(counts.projects) },
    { label: "Certifications", value: String(counts.certifications) },
    { label: "Languages", value: String(counts.languages) },
  ];
}

// A retired model stays readable by its id, so it is shown as written rather than dropped.
export function runDetailsOf({ units, modelId }: CurationProgress, source: RunSource): RunDetails {
  const entry = MODEL_CATALOGUE.find((candidate) => candidate.modelId === modelId);

  return {
    ...source,
    passes: `${units.saved} saved · ${units.total - units.saved} left`,
    readingWith: entry ? `${entry.providerName} · ${entry.modelId}` : modelId,
  };
}

export function failureOf(progress: CurationProgress): FailureSummary | null {
  if (progress.status !== "failed") {
    return null;
  }

  if (progress.failureReason === "model_key_rejected") {
    return {
      title: "Your AI provider refused your key",
      subject: undefined,
      reason: "Save a new key, then try again. Everything already saved is kept.",
      needsNewKey: true,
    };
  }

  const index = progress.units.list.findIndex((unit) => unit.status === "failed");
  const failed = progress.units.list[index];

  if (!failed) {
    return {
      title: "The analysis could not be completed",
      subject: undefined,
      reason: "Every attempt was used before the last pass was saved. Everything already saved is kept.",
      needsNewKey: false,
    };
  }

  return { title: `Pass ${index + 1} could not be completed`, subject: failed.title, reason: unitRowOf(failed).detail ?? "", needsNewKey: false };
}

export function refusalMessageOf(code: CurationActionErrorCode | undefined, fallback: string): string {
  return code ? REFUSALS[code] : fallback;
}

export function rerunReasonOf({ refusal }: { refusal: CurationActionErrorCode | null }): string | undefined {
  return refusal ? REFUSALS[refusal] : undefined;
}

export function statementSourceOf({ source }: Pick<CuratedStatement, "source">): string {
  return WHOLE_PROFILE_SOURCES[source.unitKind] ?? source.title;
}

export function statementCardOf(statement: CuratedStatement): StatementCardView {
  return {
    id: statement.id,
    text: statement.text,
    labels: [...statement.labels],
    quotes: statement.evidence.map((evidence) => ({ id: `${evidence.referenceId}:${evidence.start}`, text: evidence.quote })),
    source: statementSourceOf(statement),
    review: statement.review.state,
  };
}

export function statementsSummaryOf(statements: readonly CuratedStatement[]): string {
  const rejected = statements.filter((statement) => statement.review.state === "rejected").length;
  const total = counted(statements.length, "statement", "statements");

  return rejected > 0 ? `${total} · ${rejected} rejected, not used` : total;
}

export function jobMatchingLockOf(completed: boolean): string {
  return completed ? "Job matching is the next step of the journey and is not open yet." : "Job matching opens once the analysis completes: it reads these statements, not your PDF.";
}
