import { describe, expect, it } from "vitest";

import { curationMetrics as metrics } from "./candidate.fixtures.js";
import { CurationMetricsSchema } from "./curation-metrics.js";

describe("CurationMetricsSchema", () => {
  it("accepts a career in years and months with the duration per company and the counts", () => {
    expect(CurationMetricsSchema.safeParse(metrics).success).toBe(true);
  });

  it("accepts a Profile with no Experience", () => {
    const empty = {
      careerDuration: { years: 0, months: 0 },
      durationPerCompany: [],
      counts: { roles: 0, projects: 0, certifications: 0, languages: 0, education: 0 },
    };

    expect(CurationMetricsSchema.safeParse(empty).success).toBe(true);
  });

  it.each([
    ["twelve months, which is a year", { ...metrics, careerDuration: { years: 7, months: 12 } }],
    ["negative years", { ...metrics, careerDuration: { years: -1, months: 0 } }],
    ["fractional years", { ...metrics, careerDuration: { years: 7.5, months: 0 } }],
    ["a company with no name", { ...metrics, durationPerCompany: [{ company: " ", duration: { years: 1, months: 0 } }] }],
    ["a negative count", { ...metrics, counts: { ...metrics.counts, roles: -1 } }],
    ["a missing count", { ...metrics, counts: { roles: 2, projects: 1, certifications: 1, languages: 2 } }],
  ])("rejects %s", (_label, input) => {
    expect(CurationMetricsSchema.safeParse(input).success).toBe(false);
  });
});
