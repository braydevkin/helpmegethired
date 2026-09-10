import { describe, expect, it } from "vitest";

import { careerDuration, yearMonthOf } from "./career";

const today = new Date("2026-09-08T12:00:00Z");

describe("careerDuration", () => {
  it("counts overlapping years once: 2019 to 2021 and 2020 to 2022 are four years, not six", () => {
    expect(
      careerDuration(
        [
          { start: "2019-01", end: "2021-12" },
          { start: "2020-01", end: "2022-12" },
        ],
        today,
      ),
    ).toEqual({ years: 4, months: 0 });
  });

  it("ends an open period on the injected day", () => {
    expect(careerDuration([{ start: "2026-01", end: null }], today)).toEqual({ years: 0, months: 9 });
    expect(yearMonthOf(today)).toBe("2026-09");
  });

  it("counts both ends of a period", () => {
    expect(careerDuration([{ start: "2021-03", end: "2022-02" }], today)).toEqual({ years: 1, months: 0 });
  });

  it("merges adjacent periods and keeps a gap apart", () => {
    expect(
      careerDuration(
        [
          { start: "2018-01", end: "2018-06" },
          { start: "2018-07", end: "2018-12" },
          { start: "2020-01", end: "2020-01" },
        ],
        today,
      ),
    ).toEqual({ years: 1, months: 1 });
  });

  it("ignores a period that ends before it starts and answers zero for none", () => {
    expect(careerDuration([{ start: "2022-05", end: "2021-01" }], today)).toEqual({ years: 0, months: 0 });
    expect(careerDuration([], today)).toEqual({ years: 0, months: 0 });
  });

  it("keeps the months a whole-year count would drop", () => {
    expect(careerDuration([{ start: "2016-06", end: "2021-02" }], today)).toEqual({ years: 4, months: 9 });
  });
});
