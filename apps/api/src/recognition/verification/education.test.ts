import type { SegmentRecognition } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { extractEducation } from "../../parser";
import { verifyEducation } from "./education";

type EducationByModel = SegmentRecognition<"education">["education"][number];

const quoted = (value: string, quote = value) => ({ value, quote });

describe("verifyEducation", () => {
  const lines = ["MSc in Computer Science, University of Cambridge", "2014 – 2016", "", "BSc in Mathematics, University of Leeds", "2011 – 2014", "", "Le Wagon — Web Development Bootcamp, 2017"];
  const byRules = { education: extractEducation(lines.slice(0, 5)) };

  const cambridge: EducationByModel = {
    institution: quoted("University of Cambridge"),
    degree: quoted("MSc"),
    fieldOfStudy: quoted("Computer Science"),
    period: { start: "2014-01", end: "2016-12", quote: "2014 – 2016" },
  };

  it("pairs each entry with its own and raises agreement to high, a period of years whatever months the Model filled in", () => {
    const leeds: EducationByModel = {
      institution: quoted("University of Leeds"),
      degree: quoted("BSc"),
      fieldOfStudy: quoted("Mathematics"),
      period: { start: "2011-09", end: "2014-06", quote: "2011 – 2014" },
    };
    const { education } = verifyEducation(lines, byRules, { education: [leeds, cambridge] });

    expect(education).toEqual([
      {
        institution: { value: "University of Cambridge", confidence: "high" },
        degree: { value: "MSc", confidence: "high" },
        fieldOfStudy: { value: "Computer Science", confidence: "high" },
        period: { value: { start: "2014-01", end: "2016-12" }, confidence: "high" },
      },
      {
        institution: { value: "University of Leeds", confidence: "high" },
        degree: { value: "BSc", confidence: "high" },
        fieldOfStudy: { value: "Mathematics", confidence: "high" },
        period: { value: { start: "2011-01", end: "2014-12" }, confidence: "high" },
      },
    ]);
  });

  it("keeps an entry only the Model read after the ones above it, confirming the degree by the dictionary and not the institution", () => {
    const bootcamp: EducationByModel = {
      institution: quoted("Le Wagon"),
      degree: quoted("Web Development Bootcamp"),
      fieldOfStudy: null,
      period: null,
    };
    const { education } = verifyEducation(lines, byRules, { education: [bootcamp, cambridge] });

    expect(education.map((entry) => entry.institution.value)).toEqual(["University of Cambridge", "Le Wagon"]);
    expect(education[1]).toEqual({
      institution: { value: "Le Wagon", confidence: "medium" },
      degree: { value: "Web Development Bootcamp", confidence: "high" },
      fieldOfStudy: null,
      period: null,
    });
  });

  it("leaves out an entry only the rules read", () => {
    const { education } = verifyEducation(lines, byRules, { education: [cambridge] });

    expect(education.map((entry) => entry.institution.value)).toEqual(["University of Cambridge"]);
  });

  it("keeps a field only the rules read at the rules' Confidence", () => {
    const withoutDegree = ["Politécnico de Leiria, Engenharia Informática", "2010 – 2013"];
    const rules = { education: extractEducation(withoutDegree) };
    const leiria: EducationByModel = {
      institution: quoted("Politécnico de Leiria"),
      degree: null,
      fieldOfStudy: quoted("Engenharia Informática"),
      period: null,
    };
    const [entry] = verifyEducation(withoutDegree, rules, { education: [leiria] }).education;

    expect(entry).toEqual({
      institution: { value: "Politécnico de Leiria", confidence: "high" },
      degree: { value: "Engenharia Informática", confidence: "low" },
      fieldOfStudy: { value: "Engenharia Informática", confidence: "medium" },
      period: { value: { start: "2010-01", end: "2013-12" }, confidence: "high" },
    });
  });
});
