import { describe, expect, it } from "vitest";

import { alignEntries, oneLineEntryScore, spanningEntryScore, type LocatedEntry } from "./align-entries";

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

  it("pairs languages listed on one line by their names alone", () => {
    const aligned = alignEntries(
      [entry("model French", "French", [0]), entry("model English", "English", [0])],
      [entry("rules English", "English", [0]), entry("rules Portuguese", "Portuguese", [0])],
      oneLineEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: "model English", byRules: "rules English" },
      { byModel: null, byRules: "rules Portuguese" },
      { byModel: "model French", byRules: null },
    ]);
  });

  it("keeps every entry only one reading found, in the order they sit in the Segment", () => {
    const aligned = alignEntries(
      [entry("model MSc", "MSc Computer Science University of Cambridge", [0, 1]), entry("model School", "Leeds Grammar School", [6, 7])],
      [entry("rules MSc", "University of Cambridge MSc Computer Science", [0]), entry("rules BSc", "University of Leeds BSc Mathematics", [3])],
      spanningEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: "model MSc", byRules: "rules MSc" },
      { byModel: null, byRules: "rules BSc" },
      { byModel: "model School", byRules: null },
    ]);
  });

  it("puts an entry only the Model read before the rules entry below it", () => {
    const aligned = alignEntries([entry("model first", "Acme", [0])], [entry("rules second", "Globex", [4])], oneLineEntryScore);

    expect(aligned).toEqual([
      { byModel: "model first", byRules: null },
      { byModel: null, byRules: "rules second" },
    ]);
  });

  it("gives each Model entry to one rules entry only, the closest name first", () => {
    const aligned = alignEntries(
      [entry("model", "AWS Solutions Architect Associate", [0])],
      [entry("rules partial", "AWS Solutions Architect", [0]), entry("rules exact", "AWS Solutions Architect Associate", [0])],
      oneLineEntryScore,
    );

    expect(aligned).toEqual([
      { byModel: null, byRules: "rules partial" },
      { byModel: "model", byRules: "rules exact" },
    ]);
  });
});
