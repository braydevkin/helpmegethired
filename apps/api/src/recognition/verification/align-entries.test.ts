import { describe, expect, it } from "vitest";

import { alignEntries, locatedEntries, oneLineEntryScore, spanningEntryScore, type LocatedEntry } from "./align-entries";
import { SegmentText } from "./segment-text";

const entry = (name: string, identity: string, lines: number[]): LocatedEntry<string> => ({ entry: name, identity, lines });

describe("alignEntries", () => {
  it("pairs an Experience whose heading the rules split the wrong way round", () => {
    const aligned = alignEntries(
      [entry("model", "Backend Engineer Difference Works", [0, 1])],
      [entry("rules", "Difference Works Backend Engineer", [0])],
      spanningEntryScore,
    );

    expect(aligned).toEqual([{ byModel: "model", byRules: "rules" }]);
  });

  it("pairs an Experience whose heading the rules took from a bullet, by the lines both cover", () => {
    const aligned = alignEntries(
      [entry("model", "Backend Engineer Difference Works", [0, 1, 2, 3])],
      [entry("rules", "Built the billing service", [1, 2, 3])],
      spanningEntryScore,
    );

    expect(aligned).toEqual([{ byModel: "model", byRules: "rules" }]);
  });

  it("pairs languages listed on one line by their names alone and leaves out a language only the rules read", () => {
    const aligned = alignEntries(
      [entry("model French", "French", [0]), entry("model English", "English", [0])],
      [entry("rules English", "English", [0]), entry("rules Portuguese", "Portuguese", [0])],
      oneLineEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: "model English", byRules: "rules English" },
      { byModel: "model French", byRules: null },
    ]);
  });

  it("keeps every entry the Model read, in the order they sit in the Segment, and none only the rules read", () => {
    const aligned = alignEntries(
      [entry("model MSc", "MSc Computer Science University of Cambridge", [0, 1]), entry("model School", "Leeds Grammar School", [6, 7])],
      [entry("rules MSc", "University of Cambridge MSc Computer Science", [0]), entry("rules BSc", "University of Leeds BSc Mathematics", [3])],
      spanningEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: "model MSc", byRules: "rules MSc" },
      { byModel: "model School", byRules: null },
    ]);
  });

  it("puts an entry only the Model read before the paired entry below it", () => {
    const aligned = alignEntries(
      [entry("model second", "Globex", [4]), entry("model first", "Acme", [0])],
      [entry("rules second", "Globex", [4])],
      oneLineEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: "model first", byRules: null },
      { byModel: "model second", byRules: "rules second" },
    ]);
  });

  it("answers nothing when the Model read no entry, whatever the rules read", () => {
    expect(alignEntries([], [entry("rules", "Acme", [0])], oneLineEntryScore)).toEqual([]);
  });

  it("gives each Model entry to one rules entry only, the closest name first", () => {
    const aligned = alignEntries(
      [entry("model", "AWS Solutions Architect Associate", [0])],
      [entry("rules partial", "AWS Solutions Architect", [0]), entry("rules exact", "AWS Solutions Architect Associate", [0])],
      oneLineEntryScore,
    );

    expect(aligned).toEqual([{ byModel: "model", byRules: "rules exact" }]);
  });
});

describe("locatedEntries", () => {
  const lines = [
    "Backend Engineer | Acme",
    "2021 – Present",
    "Runs the billing platform.",
    "",
    "Backend Engineer | Globex",
    "2018 – 2021",
    "Built the payments service.",
  ];
  const text = new SegmentText(lines);

  it("places an entry whose role is written twice where its own dates and description are", () => {
    const [globex] = locatedEntries(text, [{ entry: "Globex", names: ["Backend Engineer", "Globex"], texts: ["Backend Engineer", "2018 – 2021", "Built the payments service."] }]);

    expect(globex?.lines).toEqual([4, 5, 6]);
  });

  it("places each of two entries that say only the same role after the entry before it", () => {
    const located = locatedEntries(text, [
      { entry: "first", names: ["Backend Engineer"], texts: ["Backend Engineer"] },
      { entry: "second", names: ["Backend Engineer"], texts: ["Backend Engineer"] },
    ]);

    expect(located.map((each) => each.lines)).toEqual([[0], [4]]);
  });

  it("pairs each Model entry with the rules entry of the same position when both name the same role", () => {
    const aligned = alignEntries(
      locatedEntries(text, [
        { entry: "model Globex", names: ["Backend Engineer"], texts: ["Backend Engineer", "2018 – 2021", "Built the payments service."] },
        { entry: "model Acme", names: ["Backend Engineer"], texts: ["Backend Engineer", "2021 – Present", "Runs the billing platform."] },
      ]),
      locatedEntries(text, [
        { entry: "rules Acme", names: ["Backend Engineer"], texts: ["Backend Engineer", "Runs the billing platform."] },
        { entry: "rules Globex", names: ["Backend Engineer"], texts: ["Backend Engineer", "Built the payments service."] },
      ]),
      spanningEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: "model Acme", byRules: "rules Acme" },
      { byModel: "model Globex", byRules: "rules Globex" },
    ]);
  });

  it("places an entry none of whose texts the Segment says on no line", () => {
    expect(locatedEntries(text, [{ entry: "unknown", names: ["Initech"], texts: ["Initech", undefined] }])[0]?.lines).toEqual([]);
  });
});
