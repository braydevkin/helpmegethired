import type { ReviewFlag } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { reviewNoteOf, reviewNoticeOf } from "./review";

const lowConfidence = (part: ReviewFlag["part"], entry: string | null, field: string): ReviewFlag => ({ part, entry, field, reason: "low_confidence" });

describe("reviewNoticeOf", () => {
  it("has no notice when nothing was recognized with low confidence", () => {
    expect(reviewNoticeOf([])).toBeNull();
  });

  it("counts one flagged field in the singular", () => {
    expect(reviewNoticeOf([lowConfidence("experience", "Freelance Developer", "period")])).toEqual({
      title: "1 field needs your eyes",
      detail: "The dates on “Freelance Developer” look ambiguous. Everything else was extracted with high confidence.",
    });
  });

  it("names every flagged field, with the clauses the design writes out", () => {
    const notice = reviewNoticeOf([
      lowConfidence("experience", "Freelance Developer", "period"),
      lowConfidence("experience", "Backend Engineer", "company"),
      lowConfidence("education", "Open University", "degree"),
    ]);

    expect(notice?.title).toBe("3 fields need your eyes");
    expect(notice?.detail).toBe(
      "The dates on “Freelance Developer” look ambiguous, the company on “Backend Engineer” could not be split from the title, " +
        "and the degree on “Open University” is unclear. Everything else was extracted with high confidence.",
    );
  });

  it("names a field of the Basic Profile without an entry, and a header that disagrees with the Account", () => {
    const notice = reviewNoticeOf([
      lowConfidence("basicProfile", null, "githubUrl"),
      { part: "basicProfile", entry: null, field: "name", reason: "account_mismatch" },
    ]);

    expect(notice?.detail).toBe(
      "Your GitHub URL needs a second look, and the name in your PDF is not the one on your account. Everything else was extracted with high confidence.",
    );
  });
});

describe("reviewNoteOf", () => {
  it("tells an entry what to confirm, in place", () => {
    const flags = [lowConfidence("experience", "Freelance Developer", "period")];

    expect(reviewNoteOf(flags, "experience", "Freelance Developer")).toBe("Dates need confirming — the PDF lists only years.");
    expect(reviewNoteOf(flags, "experience", "Backend Engineer")).toBeNull();
    expect(reviewNoteOf([], "experience", "Freelance Developer")).toBeNull();
  });

  it("joins the notes of an entry flagged more than once", () => {
    const flags = [lowConfidence("experience", "Freelance Developer", "period"), lowConfidence("experience", "Freelance Developer", "company")];

    expect(reviewNoteOf(flags, "experience", "Freelance Developer")).toBe(
      "Dates need confirming — the PDF lists only years. The company needs confirming — the PDF lists it with the title.",
    );
  });
});
