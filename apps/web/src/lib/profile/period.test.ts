import type { Experience } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { careerSpanOf, periodLabelOf } from "./period";

const roleWith = (period: Experience["period"]): Experience => ({
  id: crypto.randomUUID(),
  company: "Analytical Engines Ltd",
  role: "Engineer",
  period,
  description: null,
  skills: [],
});

describe("periodLabelOf", () => {
  it("reads by year and calls an open period present", () => {
    expect(periodLabelOf({ start: "2020-03", end: "2022-11" })).toBe("2020 — 2022");
    expect(periodLabelOf({ start: "2022-01", end: null })).toBe("2022 — present");
  });
});

describe("careerSpanOf", () => {
  it("runs from the first year worked to today while a position is held", () => {
    expect(careerSpanOf([roleWith({ start: "2020-01", end: "2022-12" }), roleWith({ start: "2017-06", end: null })])).toBe("2017 — present");
  });

  it("ends on the last year worked when every position is closed", () => {
    expect(careerSpanOf([roleWith({ start: "2017-06", end: "2019-12" }), roleWith({ start: "2020-01", end: "2022-12" })])).toBe("2017 — 2022");
  });

  it("has no span when no Experience carries a period", () => {
    expect(careerSpanOf([roleWith(null)])).toBeNull();
    expect(careerSpanOf([])).toBeNull();
  });
});
