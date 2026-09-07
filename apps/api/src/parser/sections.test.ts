import { describe, expect, it } from "vitest";

import { HEADER_THRESHOLD, isHeader, scoreHeader, splitSections } from "./sections";

describe("scoreHeader", () => {
  it("gives a dictionary line two points and one for each other sign", () => {
    expect(scoreHeader("Experience", "Acme")).toEqual({ kind: "experience", score: 3 });
    expect(scoreHeader("EXPERIENCE", "")).toEqual({ kind: "experience", score: 5 });
    expect(scoreHeader("Professional experience at several companies over the years", "")).toEqual({
      kind: undefined,
      score: 1,
    });
  });

  it("reads Portuguese headings without their accents or decorations", () => {
    expect(isHeader("EXPERIÊNCIA PROFISSIONAL:", "Acme")).toBe("experience");
    expect(isHeader("— Formação Acadêmica —", "")).toBe("education");
    expect(isHeader("Certificações", "")).toBe("certifications");
  });

  it("never promotes a dictionary word used inside a sentence", () => {
    expect(isHeader("I gained experience building queues for years at Acme", "")).toBeUndefined();
    expect(scoreHeader("EDUCATION AND HOBBIES OF A LIFETIME SPENT LEARNING", "").score).toBeLessThan(HEADER_THRESHOLD);
  });

  it("needs a dictionary match, whatever the other signs", () => {
    expect(isHeader("ADA LOVELACE", "")).toBeUndefined();
  });
});

describe("splitSections", () => {
  const lines = [
    "Ada Lovelace",
    "Backend engineer",
    "",
    "EXPERIENCE",
    "Acme, Senior Engineer",
    "2019 - 2021",
    "",
    "Formação Acadêmica",
    "",
    "Universidade de Lisboa",
    "Skills",
    "TypeScript, PostgreSQL",
    "",
    "Projects",
    "",
  ];

  it("keeps the text before the first heading as the header and cuts at each heading", () => {
    expect(splitSections(lines)).toEqual([
      { kind: "header", heading: null, lines: ["Ada Lovelace", "Backend engineer"] },
      { kind: "experience", heading: "EXPERIENCE", lines: ["Acme, Senior Engineer", "2019 - 2021"] },
      { kind: "education", heading: "Formação Acadêmica", lines: ["Universidade de Lisboa"] },
      { kind: "skills", heading: "Skills", lines: ["TypeScript, PostgreSQL"] },
      { kind: "projects", heading: "Projects", lines: [] },
    ]);
  });

  it("answers no header section when the text opens with a heading", () => {
    expect(splitSections(["SUMMARY", "Ten years of queues."]).map((section) => section.kind)).toEqual(["summary"]);
  });

  it("keeps the blank lines inside a section that separate its entries", () => {
    const [experience] = splitSections(["Experience", "Acme", "2019", "", "Globex", "2017"]);

    expect(experience?.lines).toEqual(["Acme", "2019", "", "Globex", "2017"]);
  });
});
