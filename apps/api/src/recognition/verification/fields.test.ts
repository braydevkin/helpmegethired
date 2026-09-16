import type { Field } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import {
  periodReadingOf,
  periodRule,
  quotedReadingOf,
  textReadingOf,
  textRule,
  urlReadingOf,
  urlRule,
  verifiedField,
  yearRule,
  type Reading,
} from "./fields";
import { SegmentText } from "./segment-text";

const reading = <Value>(value: Value, quote: string): Reading<Value> => ({ value, quote, lines: [0] });
const high = <Value>(value: Value): Field<Value> => ({ value, confidence: "high" });
const low = <Value>(value: Value): Field<Value> => ({ value, confidence: "low" });
const medium = <Value>(value: Value): Field<Value> => ({ value, confidence: "medium" });

describe("verifiedField", () => {
  const titled = textRule((value) => value.includes("Engineer"));

  it("is high and keeps the rules' verbatim value when both readings agree", () => {
    expect(verifiedField(low("ACME Inc."), reading("Acme Inc", "ACME Inc."), textRule())).toEqual(high("ACME Inc."));
  });

  it("keeps the rules' field when the Model read nothing", () => {
    expect(verifiedField(low("Acme"), null, textRule())).toEqual(low("Acme"));
  });

  it("is absent when neither reading found the field", () => {
    expect(verifiedField(null, null, textRule())).toBeNull();
  });

  it("is high for a value only the Model read that a rule confirms, and medium otherwise", () => {
    expect(verifiedField(null, reading("Backend Engineer", "Backend Engineer"), titled)).toEqual(high("Backend Engineer"));
    expect(verifiedField(null, reading("Acme", "Acme"), titled)).toEqual(medium("Acme"));
  });

  it("is low and keeps the Model's text when the readings disagree on text", () => {
    expect(verifiedField(high("Acme"), reading("Acme Labs", "Acme Labs"), textRule())).toEqual(low("Acme Labs"));
  });

  it("is low and keeps the rules' period when the readings disagree on a period", () => {
    const byRules = high({ start: "2019-01", end: null });

    expect(verifiedField(byRules, reading({ start: "2020-03", end: null }, "Mar 2020 – Present"), periodRule)).toEqual(low({ start: "2019-01", end: null }));
  });

  it("agrees with the rules on a period whose quote says only the years they read", () => {
    const byRules = high({ start: "2011-01", end: "2014-12" });

    expect(verifiedField(byRules, reading({ start: "2011-09", end: "2014-06" }, "2011 – 2014"), periodRule)).toEqual(high({ start: "2011-01", end: "2014-12" }));
  });

  it("is low and keeps the rules' URL and year when the readings disagree on them", () => {
    expect(verifiedField(high("https://github.com/ada"), reading("https://github.com/bob", "github.com/bob"), urlRule)).toEqual(low("https://github.com/ada"));
    expect(verifiedField(medium(2021), reading(2022, "2022"), yearRule)).toEqual(low(2021));
  });
});

describe("the rules' checks", () => {
  it("confirm a period its quote parses to, and not one it does not", () => {
    expect(periodRule.confirms(reading({ start: "2021-03", end: null }, "Mar 2021 – Present"))).toBe(true);
    expect(periodRule.confirms(reading({ start: "2021-04", end: null }, "Mar 2021 – Present"))).toBe(false);
    expect(periodRule.confirms(reading({ start: "2021-03", end: null }, "early 2021"))).toBe(false);
  });

  it("agree on URLs that differ only by scheme, www, case, and a trailing slash", () => {
    expect(urlRule.agree("https://linkedin.com/in/ada", reading("https://www.LinkedIn.com/in/ada/", "linkedin.com/in/ada"))).toBe(true);
  });

  it("confirm a URL written whole in its quote, and not one that is only its beginning", () => {
    expect(urlRule.confirms(reading("https://github.com/ada/engine", "Code: github.com/ada/engine."))).toBe(true);
    expect(urlRule.confirms(reading("https://github.com/ada/other", "Code: github.com/ada/engine"))).toBe(false);
    expect(urlRule.confirms(reading("https://github.com/ada", "github.com/ada-example"))).toBe(false);
  });

  it("confirm a year written in its quote as a whole number", () => {
    expect(yearRule.confirms(reading(2023, "Amazon Web Services, 2023"))).toBe(true);
    expect(yearRule.confirms(reading(2023, "Valid until 20231"))).toBe(false);
  });
});

describe("readings", () => {
  const text = new SegmentText(["Backend Engineer | Difference Works", "Jun 2016 – Feb 2021", "github.com/ada", "Analytical Engines Ltd"]);

  it("discard a value whose quote the Segment never says", () => {
    expect(textReadingOf(text, { value: "Difference Works", quote: "Difference Works Ltd, Manchester" })).toBeNull();
    expect(periodReadingOf(text, { start: "2016-06", end: "2021-02", quote: "June 2016 to February 2021" })).toBeNull();
    expect(quotedReadingOf(text, { value: 2016, quote: "2016 to 2021" })).toBeNull();
  });

  it("discard a text value its own quote does not say, even when the Segment says it elsewhere", () => {
    expect(textReadingOf(text, { value: "Difference Engines", quote: "Difference Works" })).toBeNull();
    expect(textReadingOf(text, { value: "Analytical Engines Ltd", quote: "Difference Works" })).toBeNull();
  });

  it("discard a period that ends before it starts", () => {
    expect(periodReadingOf(text, { start: "2021-02", end: "2016-06", quote: "Jun 2016 – Feb 2021" })).toBeNull();
  });

  it("discard a URL that is not a web address", () => {
    expect(urlReadingOf(text, { value: "javascript:alert(1)", quote: "github.com/ada" })).toBeNull();
    expect(urlReadingOf(text, { value: "https://github.com/ada", quote: "github.com/ada" })).toEqual({ value: "https://github.com/ada", quote: "github.com/ada", lines: [2] });
  });

  it("keep a grounded value with the lines its quote spans", () => {
    expect(textReadingOf(text, { value: "Difference Works", quote: "Backend Engineer | Difference Works" })).toEqual({
      value: "Difference Works",
      quote: "Backend Engineer | Difference Works",
      lines: [0],
    });
    expect(periodReadingOf(text, { start: "2016-06", end: "2021-02", quote: "Jun 2016 – Feb 2021" })).toEqual({
      value: { start: "2016-06", end: "2021-02" },
      quote: "Jun 2016 – Feb 2021",
      lines: [1],
    });
  });
});
