import { describe, expect, it } from "vitest";

import { progressOf, unitOf, unitsOf } from "../curation-progress/curation-progress.fixtures";
import { statementOf } from "./statement.fixtures";
import {
  countedFactsOf,
  failureOf,
  gateNoticeOf,
  jobMatchingLockOf,
  pageHeadingOf,
  refusalMessageOf,
  runDetailsOf,
  statementCardOf,
  statementSourceOf,
  statementsSummaryOf,
  unitListRowOf,
} from "./view";

const source = { basedOn: "ada.pdf", confirmedAt: "2026-09-11T14:02:00.000Z" };
const failedAtFourth = () => [...unitsOf(3, 3, 0), unitOf(3, { status: "failed", failureReason: "timeout" }), unitOf(4)];

describe("gateNoticeOf", () => {
  it("counts the fields that still need a decision and names each one", () => {
    const notice = gateNoticeOf([
      { part: "basicProfile", entry: null, field: "location", reason: "low_confidence" },
      { part: "experience", entry: "Backend Engineer", field: "period", reason: "low_confidence" },
    ]);

    expect(notice).toEqual({
      title: "2 fields still need a decision",
      detail: "Your location needs a second look, and the dates on “Backend Engineer” look ambiguous. Fix or accept them, then confirm your profile to move on to the analysis.",
    });
  });

  it("says one field in the singular", () => {
    expect(gateNoticeOf([{ part: "basicProfile", entry: null, field: "location", reason: "low_confidence" }]).title).toBe("1 field still needs a decision");
  });

  it("asks only for the confirmation when nothing was flagged", () => {
    expect(gateNoticeOf([])).toEqual({ title: "Nothing was flagged", detail: "Look your profile over and confirm it to move on to the analysis." });
  });
});

describe("pageHeadingOf", () => {
  it("reads a running or paused Curation as the profile being read", () => {
    expect(pageHeadingOf(progressOf(unitsOf(9, 3)))).toMatchObject({ eyebrow: "Reading your profile", title: "Understanding what you have done", tone: "brand" });
    expect(pageHeadingOf(progressOf(unitsOf(9, 3, 0), { status: "queued", resumeAfter: "2026-09-11T14:32:00.000Z" }))).toMatchObject({ eyebrow: "Reading your profile" });
  });

  it("counts the passes of a completed Curation", () => {
    expect(pageHeadingOf(progressOf(unitsOf(9, 9, 0), { status: "completed" }))).toMatchObject({
      eyebrow: "Analysis complete",
      title: "We know your profile now",
      lead: "9 passes over your profile, each one saved with the line it came from. Review anything that reads wrong before you match your first job.",
    });
  });

  it("marks a failed or cancelled Curation as stopped", () => {
    expect(pageHeadingOf(progressOf(failedAtFourth(), { status: "failed", failureReason: "attempts_exhausted" }))).toMatchObject({
      eyebrow: "Stopped",
      title: "The analysis stopped partway",
      tone: "error",
    });
    expect(pageHeadingOf(progressOf(unitsOf(9, 3, 0), { status: "cancelled" }))).toMatchObject({ eyebrow: "Stopped", title: "You stopped the analysis", tone: "error" });
  });
});

describe("unitListRowOf", () => {
  it.each([
    ["experience", "Role"],
    ["project", "Project"],
    ["cross_cutting", "Across all"],
    ["synthesis", "Summary"],
  ] as const)("names a %s pass %s", (kind, kindLabel) => {
    expect(unitListRowOf(unitOf(0, { kind })).kindLabel).toBe(kindLabel);
  });
});

describe("countedFactsOf", () => {
  const metrics = progressOf(unitsOf(1, 0)).metrics;

  it("lists the career length, the longest tenure, and the counts", () => {
    expect(countedFactsOf(metrics)).toEqual([
      { label: "Career length", value: "7 yr 2 mo" },
      { label: "Longest tenure", value: "Northwind Labs, 4 yr" },
      { label: "Roles", value: "4" },
      { label: "Projects", value: "3" },
      { label: "Certifications", value: "2" },
      { label: "Languages", value: "3" },
    ]);
  });

  it("picks the company with the longest total duration", () => {
    const facts = countedFactsOf({
      ...metrics,
      durationPerCompany: [
        { company: "Praia Digital", duration: { years: 2, months: 3 } },
        { company: "Studio Vinte", duration: { years: 2, months: 7 } },
      ],
    });

    expect(facts).toContainEqual({ label: "Longest tenure", value: "Studio Vinte, 2 yr 7 mo" });
  });

  it("leaves the longest tenure out of a Profile with no company", () => {
    expect(countedFactsOf({ ...metrics, durationPerCompany: [] }).map((fact) => fact.label)).not.toContain("Longest tenure");
  });
});

describe("runDetailsOf", () => {
  it("counts the passes left and names the provider with the pinned model", () => {
    expect(runDetailsOf(progressOf(unitsOf(9, 3)), source)).toEqual({ ...source, passes: "3 saved · 6 left", readingWith: "Anthropic · claude-sonnet-5" });
  });

  it("shows a model that left the catalogue by its id", () => {
    expect(runDetailsOf(progressOf(unitsOf(2, 2, 0), { modelId: "claude-retired-model" }), source).readingWith).toBe("claude-retired-model");
  });
});

describe("failureOf", () => {
  it("names the pass that failed and what happened to it", () => {
    expect(failureOf(progressOf(failedAtFourth(), { status: "failed", failureReason: "attempts_exhausted" }))).toEqual({
      title: "Pass 4 could not be completed",
      subject: "Role 4 at Company 4",
      reason: "The model did not answer in time — nothing was saved for this one.",
      needsNewKey: false,
    });
  });

  it("asks for a new key when the provider refused the stored one", () => {
    expect(failureOf(progressOf(unitsOf(3, 1, 0), { status: "failed", failureReason: "model_key_rejected" }))).toMatchObject({ needsNewKey: true, title: "Your AI provider refused your key" });
  });

  it("explains a failure no single pass caused", () => {
    expect(failureOf(progressOf(unitsOf(3, 1, 0), { status: "failed", failureReason: "attempts_exhausted" }))).toMatchObject({ title: "The analysis could not be completed", subject: undefined });
  });

  it("has nothing to say about a Curation that did not fail", () => {
    expect(failureOf(progressOf(unitsOf(3, 1)))).toBeNull();
  });
});

describe("refusalMessageOf", () => {
  it("explains a refusal by its code, and falls back to the step's own message", () => {
    expect(refusalMessageOf("curation_unchanged", "fallback")).toBe("Nothing has changed since this analysis ran: the same profile and the same AI would write the same statements.");
    expect(refusalMessageOf(undefined, "fallback")).toBe("fallback");
  });
});

describe("the Statements", () => {
  it("name the Experience or Project a Statement came from, or the whole Profile", () => {
    expect(statementSourceOf(statementOf(0))).toBe("Role 1 at Company 1");
    expect(statementSourceOf(statementOf(0, { source: { unitKind: "cross_cutting", title: "Skills that repeat across roles" } }))).toBe("Across all roles and projects");
    expect(statementSourceOf(statementOf(0, { source: { unitKind: "synthesis", title: "Your overall picture" } }))).toBe("Your overall picture");
  });

  it("carry their quotes and review state onto a card", () => {
    expect(statementCardOf(statementOf(0))).toMatchObject({
      text: "Statement 1: cut a listing endpoint's response time by restructuring its queries.",
      labels: ["Performance", "Databases"],
      quotes: [{ text: "restructured the listing queries" }],
      source: "Role 1 at Company 1",
      review: "unreviewed",
    });
  });

  it("are counted with the rejected ones called out as not used", () => {
    const rejected = statementOf(1, { review: { state: "rejected", reviewedAt: "2026-09-11T15:00:00.000Z" } });

    expect(statementsSummaryOf([statementOf(0)])).toBe("1 statement");
    expect(statementsSummaryOf([statementOf(0), rejected])).toBe("2 statements · 1 rejected, not used");
  });
});

describe("jobMatchingLockOf", () => {
  it("says why job matching is closed before and after the analysis completes", () => {
    expect(jobMatchingLockOf(false)).toBe("Job matching opens once the analysis completes: it reads these statements, not your PDF.");
    expect(jobMatchingLockOf(true)).toBe("Job matching is the next step of the journey and is not open yet.");
  });
});
