import { randomUUID } from "node:crypto";

import { CurationProgressSchema, type CurationMetrics, type CurationUnitStatus, type CurationUnitSummary } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { curationProgressOf, etagOf, percentageOf, rerunOf, type ProgressedCuration } from "./curation-progress";

const metrics: CurationMetrics = {
  careerDuration: { years: 4, months: 2 },
  durationPerCompany: [{ company: "Parapet Systems", duration: { years: 4, months: 2 } }],
  counts: { roles: 1, projects: 1, certifications: 0, languages: 2, education: 1 },
};

const curation: ProgressedCuration = {
  id: randomUUID(),
  status: "running",
  modelId: "claude-sonnet-5",
  failureReason: null,
  resumeAfter: null,
  pauseReason: null,
};

const allowed = rerunOf(null);

const unitOf = (status: CurationUnitStatus, position = 0): CurationUnitSummary => ({
  id: randomUUID(),
  kind: "project",
  title: `Project ${position}`,
  status,
  failureReason: null,
});

const unitsWith = (...statuses: CurationUnitStatus[]): CurationUnitSummary[] => statuses.map((status, position) => unitOf(status, position));

describe("percentageOf", () => {
  it.each([
    [[], 0],
    [["pending", "pending"], 0],
    [["saved", "running", "pending"], 33],
    [["saved", "saved", "failed"], 66],
    [["saved", "saved"], 100],
  ] as [CurationUnitStatus[], number][])("answers %j as %i", (statuses, percentage) => {
    expect(percentageOf(unitsWith(...statuses))).toBe(percentage);
  });

  it("counts a running unit as not saved, however far its call has gone", () => {
    expect(percentageOf(unitsWith("running", "running", "running", "saved"))).toBe(25);
  });
});

describe("curationProgressOf", () => {
  it("answers the counts, every unit, the metrics, the Model the Curation was pinned to, and the re-run gate", () => {
    const units = unitsWith("saved", "running", "pending");
    const progress = curationProgressOf(curation, units, metrics, allowed);

    expect(CurationProgressSchema.parse(progress)).toEqual({
      curationId: curation.id,
      status: "running",
      percentage: 33,
      units: { total: 3, saved: 1, list: units },
      metrics,
      modelId: "claude-sonnet-5",
      failureReason: null,
      resumeAfter: null,
      pauseReason: null,
      rerun: { allowed: true, refusal: null },
    });
  });

  it("says why a paused Curation waits, a rate limit or the embedding ceiling", () => {
    const resumeAfter = new Date("2026-09-12T00:00:00.000Z");
    const atCeiling = curationProgressOf({ ...curation, status: "queued", resumeAfter, pauseReason: "embedding_ceiling" }, unitsWith("saved"), metrics, allowed);

    expect(CurationProgressSchema.parse(atCeiling)).toMatchObject({ resumeAfter: "2026-09-12T00:00:00.000Z", pauseReason: "embedding_ceiling" });
  });

  it("carries the failure reason and when a rate-limited Curation resumes", () => {
    const resumeAfter = new Date("2026-09-11T10:00:00.000Z");
    const paused = curationProgressOf({ ...curation, status: "queued", resumeAfter }, unitsWith("saved"), metrics, allowed);
    const failed = curationProgressOf({ ...curation, status: "failed", failureReason: "attempts_exhausted" }, unitsWith("failed"), metrics, allowed);

    expect(paused.resumeAfter).toBe("2026-09-11T10:00:00.000Z");
    expect(failed.failureReason).toBe("attempts_exhausted");
  });
});

describe("rerunOf", () => {
  it("allows a re-run exactly when there is no refusal", () => {
    expect(rerunOf(null)).toEqual({ allowed: true, refusal: null });
    expect(rerunOf("curation_unchanged")).toEqual({ allowed: false, refusal: "curation_unchanged" });
  });
});

describe("etagOf", () => {
  it("is the same for the same answer and changes when a unit is saved", () => {
    const running = unitOf("running", 0);
    const pending = unitOf("pending", 1);
    const before = { progress: curationProgressOf(curation, [running, pending], metrics, allowed) };
    const after = { progress: curationProgressOf(curation, [{ ...running, status: "saved" }, pending], metrics, allowed) };

    expect(etagOf(before)).toBe(etagOf(structuredClone(before)));
    expect(etagOf(after)).not.toBe(etagOf(before));
    expect(etagOf({ progress: null })).toMatch(/^"[0-9a-f]{40}"$/);
  });

  it("changes when a re-run becomes available, although the Curation itself did not change", () => {
    const completed: ProgressedCuration = { ...curation, status: "completed" };
    const units = unitsWith("saved");
    const refused = { progress: curationProgressOf(completed, units, metrics, rerunOf("curation_unchanged")) };
    const available = { progress: curationProgressOf(completed, units, metrics, allowed) };

    expect(etagOf(available)).not.toBe(etagOf(refused));
  });
});
