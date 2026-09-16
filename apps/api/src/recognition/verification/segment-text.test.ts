import { describe, expect, it } from "vitest";

import { SegmentText, comparable, holdsWords } from "./segment-text";

describe("SegmentText", () => {
  const text = new SegmentText(["Senior Backend Engineer | Analytical Engines Ltd", "", "Own the   ingestion platform on Google Cloud.", "Cut the median time. São Paulo"]);

  it("finds a quote whatever its case and spacing, and answers the line it sits on", () => {
    expect(text.linesOf("analytical engines LTD")).toEqual([0]);
    expect(text.linesOf("Own the ingestion platform")).toEqual([2]);
  });

  it("finds a quote that runs across lines, skipping the blank line between them", () => {
    expect(text.linesOf("Analytical Engines Ltd Own the ingestion")).toEqual([0, 1, 2]);
    expect(text.linesOf("Google Cloud.\nCut the median")).toEqual([2, 3]);
  });

  it("does not find a quote the Segment never says, nor one with different accents", () => {
    expect(text.linesOf("Difference Works")).toBeUndefined();
    expect(text.linesOf("Sao Paulo")).toBeUndefined();
  });

  it("does not find a quote that starts or ends inside a word", () => {
    expect(text.linesOf("Go")).toBeUndefined();
    expect(text.linesOf("Engine")).toBeUndefined();
    expect(text.linesOf("ngine")).toBeUndefined();
  });

  it("answers the lines of every whole occurrence of a quote, in the order the text says them", () => {
    const twice = new SegmentText(["Backend Engineer | Acme", "Senior Backend Engineers", "", "Backend Engineer | Globex"]);

    expect(twice.occurrencesOf("backend engineer")).toEqual([[0], [3]]);
    expect(twice.occurrencesOf("Initech")).toEqual([]);
  });

  it("finds a later whole occurrence when an earlier one sits inside a word", () => {
    const repeated = new SegmentText(["Built on Google Cloud", "Wrote the Go services"]);

    expect(repeated.linesOf("Go")).toEqual([1]);
  });
});

describe("holdsWords", () => {
  it("holds a value by its words, blind to case, accents, and punctuation, but not a part of a word", () => {
    expect(holdsWords("Senior Backend Engineer | Analytical Engines Ltd", "Analytical Engines Ltd.")).toBe(true);
    expect(holdsWords("São Paulo", "sao paulo")).toBe(true);
    expect(holdsWords("Analytical Engines Ltd", "Engine")).toBe(false);
    expect(holdsWords("Analytical Engines Ltd", "—")).toBe(false);
  });
});

describe("comparable", () => {
  it("reads line breaks and bullets as spaces", () => {
    expect(comparable("Built it.\nShipped — it!")).toBe(comparable("built it shipped it"));
  });
});
