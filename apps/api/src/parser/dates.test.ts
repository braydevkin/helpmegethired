import { describe, expect, it } from "vitest";

import { findDateRange, withoutDateRange } from "./dates";

describe("findDateRange", () => {
  it.each([
    ["Mar 2021 – Present", { start: "2021-03", end: null }],
    ["March 2021 - present", { start: "2021-03", end: null }],
    ["Jun 2016 – Feb 2021", { start: "2016-06", end: "2021-02" }],
    ["September 2018 to December 2020", { start: "2018-09", end: "2020-12" }],
    ["2019 - 2021", { start: "2019-01", end: "2021-12" }],
    ["2019 — Current", { start: "2019-01", end: null }],
    ["08/2020 – Atual", { start: "2020-08", end: null }],
    ["02/2018 – 07/2020", { start: "2018-02", end: "2020-07" }],
    ["março de 2016 – março de 2019", { start: "2016-03", end: "2019-03" }],
    ["abril de 2019 – atual", { start: "2019-04", end: null }],
    ["fev 2021 a dez 2022", { start: "2021-02", end: "2022-12" }],
    ["2015 até 2017", { start: "2015-01", end: "2017-12" }],
    ["desde 2020", { start: "2020-01", end: null }],
    ["Since May 2019", { start: "2019-05", end: null }],
    ["Sept. 2019 - Oct. 2020", { start: "2019-09", end: "2020-10" }],
  ])("reads %s", (line, period) => {
    expect(findDateRange(line)?.period).toEqual(period);
  });

  it("finds the range inside a line and answers the rest of the line", () => {
    const line = "London · Mar 2021 – Present";
    const match = findDateRange(line);

    expect(match).toMatchObject({ period: { start: "2021-03", end: null }, index: 9 });
    expect(withoutDateRange(line, match!)).toBe("London ·");
  });

  it.each(["Senior Engineer at Acme", "Phone: 2019 20211234", "Version 2.0 released", "Built 3 services in 12 months"])(
    "finds no range in %s",
    (line) => {
      expect(findDateRange(line)).toBeUndefined();
    },
  );
});
