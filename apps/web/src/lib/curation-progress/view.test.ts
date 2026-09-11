import { describe, expect, it } from "vitest";

import { progressOf, unitOf, unitsOf } from "./curation-progress.fixtures";
import { durationLabelOf, focusIndexOf, footnoteOf, headingOf, isSettled, metricChipsOf, passLabelOf, phaseOf, unitRowOf, unitWindowOf } from "./view";

const RESUME_AFTER = "2026-09-11T14:32:00.000Z";

describe("isSettled", () => {
  it("watches a queued or running Curation and nothing else", () => {
    expect(isSettled({ progress: null })).toBe(true);

    for (const status of ["queued", "running"] as const) {
      expect(isSettled({ progress: progressOf(unitsOf(2, 0), { status }) })).toBe(false);
    }

    for (const status of ["completed", "failed", "cancelled", "superseded"] as const) {
      expect(isSettled({ progress: progressOf(unitsOf(2, 0, 0), { status }) })).toBe(true);
    }
  });
});

describe("phaseOf", () => {
  it("reads a queued Curation with a resume time as paused", () => {
    expect(phaseOf({ status: "queued", resumeAfter: RESUME_AFTER })).toBe("paused");
    expect(phaseOf({ status: "queued", resumeAfter: null })).toBe("active");
    expect(phaseOf({ status: "running", resumeAfter: null })).toBe("active");
    expect(phaseOf({ status: "failed", resumeAfter: null })).toBe("failed");
  });
});

describe("focusIndexOf", () => {
  it("names the first running unit, else the next waiting, else the first failed", () => {
    expect(focusIndexOf(unitsOf(9, 3, 3))).toBe(3);
    expect(focusIndexOf(unitsOf(9, 3, 0))).toBe(3);
    expect(focusIndexOf([unitOf(0, { status: "saved" }), unitOf(1, { status: "failed" })])).toBe(1);
    expect(focusIndexOf(unitsOf(4, 4, 0))).toBe(3);
    expect(focusIndexOf([])).toBe(0);
  });
});

describe("unitWindowOf", () => {
  const forty = unitsOf(40, 20);

  it("keeps the saved pass before the focused one in view", () => {
    expect(unitWindowOf(forty, 20).map((unit) => unit.title)).toEqual(["Role 20 at Company 20", "Role 21 at Company 21", "Role 22 at Company 22", "Role 23 at Company 23", "Role 24 at Company 24"]);
  });

  it("stays inside the list at both ends and shows every unit of a short one", () => {
    expect(unitWindowOf(forty, 0)[0]?.title).toBe("Role 1 at Company 1");
    expect(unitWindowOf(forty, 39).map((unit) => unit.title).at(-1)).toBe("Role 40 at Company 40");
    expect(unitWindowOf(forty, 39)).toHaveLength(5);
    expect(unitWindowOf(unitsOf(1, 0), 0)).toHaveLength(1);
  });
});

describe("passLabelOf", () => {
  it("names the pass being read, or the next one while waiting", () => {
    expect(passLabelOf(progressOf(unitsOf(9, 3)))).toBe("Pass 4 of 9 · Role 4 at Company 4");
    expect(passLabelOf(progressOf(unitsOf(9, 0, 0), { status: "queued" }))).toBe("Next: pass 1 of 9 · Role 1 at Company 1");
  });

  it("counts what was saved once the Curation settles", () => {
    expect(passLabelOf(progressOf(unitsOf(9, 9, 0), { status: "completed" }))).toBe("All 9 passes saved");
    expect(passLabelOf(progressOf(unitsOf(9, 3, 0), { status: "failed", failureReason: "attempts_exhausted" }))).toBe("Stopped after 3 of 9 passes");
    expect(passLabelOf(progressOf(unitsOf(9, 3, 0), { status: "cancelled" }))).toBe("Stopped after 3 of 9 passes");
    expect(passLabelOf(progressOf(unitsOf(9, 3, 0), { status: "superseded" }))).toBe("3 of 9 passes were saved");
  });
});

describe("unitRowOf", () => {
  it("writes the status out and explains a failed pass in plain words", () => {
    expect(unitRowOf(unitOf(0, { status: "saved" }))).toMatchObject({ state: "done", statusLabel: "Saved", detail: undefined });
    expect(unitRowOf(unitOf(0, { status: "running" }))).toMatchObject({ state: "active", statusLabel: "Reading" });
    expect(unitRowOf(unitOf(0, { status: "pending" }))).toMatchObject({ state: "waiting", statusLabel: "Waiting" });
    expect(unitRowOf(unitOf(0, { status: "failed", failureReason: "timeout" }))).toMatchObject({
      state: "failed",
      statusLabel: "Failed",
      detail: "The model did not answer in time — nothing was saved for this one.",
    });
    expect(unitRowOf(unitOf(0, { status: "failed" })).detail).toBe("This pass could not be completed — nothing was saved for this one.");
  });
});

describe("headingOf and footnoteOf", () => {
  it("tell a refused key apart from exhausted attempts", () => {
    expect(headingOf(progressOf(unitsOf(3, 1, 0), { status: "failed", failureReason: "model_key_rejected" })).lead).toContain("refused the key");
    expect(headingOf(progressOf(unitsOf(3, 1, 0), { status: "failed", failureReason: "attempts_exhausted" })).lead).toContain("picks up exactly where it stopped");
  });

  it("say the tab can be closed only while the Curation is still being read", () => {
    expect(footnoteOf(progressOf(unitsOf(3, 1)))).toContain("Safe to close this tab");
    expect(footnoteOf(progressOf(unitsOf(3, 1), { status: "queued", resumeAfter: RESUME_AFTER }))).toContain("Safe to close this tab");
    expect(footnoteOf(progressOf(unitsOf(3, 1, 0), { status: "failed", failureReason: "attempts_exhausted" }))).toContain("Nothing is lost");
    expect(footnoteOf(progressOf(unitsOf(3, 3, 0), { status: "completed" }))).toBeUndefined();
  });
});

describe("metricChipsOf", () => {
  it("shows the career length and the counts the model was given, leaving out what is zero", () => {
    expect(metricChipsOf(progressOf(unitsOf(1, 0)).metrics)).toEqual(["7 yr 2 mo career", "4 roles", "3 projects"]);
    expect(
      metricChipsOf({ careerDuration: { years: 0, months: 0 }, durationPerCompany: [], counts: { roles: 1, projects: 0, certifications: 0, languages: 0, education: 0 } }),
    ).toEqual(["1 role"]);
  });

  it("writes a duration in years and months", () => {
    expect(durationLabelOf({ years: 3, months: 0 })).toBe("3 yr");
    expect(durationLabelOf({ years: 0, months: 5 })).toBe("5 mo");
    expect(durationLabelOf({ years: 0, months: 0 })).toBe("Under a month");
  });
});
