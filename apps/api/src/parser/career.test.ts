import { describe, expect, it } from "vitest";

import { careerMonths, careerYears, yearMonthOf } from "./career";

const today = new Date("2026-09-08T12:00:00Z");

describe("careerMonths", () => {
  it("counts overlapping years once: 2019 to 2021 and 2020 to 2022 are 48 months, not 72", () => {
    expect(
      careerMonths(
        [
          { start: "2019-01", end: "2021-12" },
          { start: "2020-01", end: "2022-12" },
        ],
        today,
      ),
    ).toBe(48);
  });

  it("ends an open period today", () => {
    expect(careerMonths([{ start: "2026-01", end: null }], today)).toBe(9);
  });

  it("counts both ends of a period", () => {
    expect(careerMonths([{ start: "2021-03", end: "2022-02" }], today)).toBe(12);
  });

  it("merges adjacent periods and keeps a gap apart", () => {
    expect(
      careerMonths(
        [
          { start: "2018-01", end: "2018-06" },
          { start: "2018-07", end: "2018-12" },
          { start: "2020-01", end: "2020-01" },
        ],
        today,
      ),
    ).toBe(13);
  });

  it("ignores a period that ends before it starts and answers zero for none", () => {
    expect(careerMonths([{ start: "2022-05", end: "2021-01" }], today)).toBe(0);
    expect(careerMonths([], today)).toBe(0);
  });

  it("answers whole years", () => {
    expect(careerYears([{ start: "2016-06", end: "2021-02" }], today)).toBe(4);
    expect(yearMonthOf(today)).toBe("2026-09");
  });
});
