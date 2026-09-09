import { describe, expect, it } from "vitest";

import { extractEducation } from "./education";

describe("extractEducation", () => {
  it("splits degree, field of study, and institution around the connector", () => {
    const [master, bachelor] = extractEducation([
      "MSc in Computer Science, University of Cambridge",
      "2014 – 2016",
      "",
      "Bacharelado em Matemática, Universidade Federal do Paraná",
      "2011 – 2014",
    ]);

    expect(master).toEqual({
      institution: { value: "University of Cambridge", confidence: "high" },
      degree: { value: "MSc", confidence: "high" },
      fieldOfStudy: { value: "Computer Science", confidence: "high" },
      period: { value: { start: "2014-01", end: "2016-12" }, confidence: "high" },
    });
    expect(bachelor).toMatchObject({
      institution: { value: "Universidade Federal do Paraná" },
      degree: { value: "Bacharelado" },
      fieldOfStudy: { value: "Matemática" },
    });
  });

  it("reads the LinkedIn layout: institution line, then degree and field beside the dates", () => {
    const [entry] = extractEducation(["Tallinn University of Technology", "MSc, Computer Science · (2011 – 2013)"]);

    expect(entry).toMatchObject({
      institution: { value: "Tallinn University of Technology", confidence: "high" },
      degree: { value: "MSc" },
      fieldOfStudy: { value: "Computer Science" },
      period: { value: { start: "2011-01", end: "2013-12" } },
    });
  });

  it("reads the dates-first layout and joins a wrapped institution name", () => {
    const [entry] = extractEducation(["2012 – 2016 Bacharelado em Ciência da Computação, Universidade", "Federal do Paraná"]);

    expect(entry).toMatchObject({
      institution: { value: "Universidade Federal do Paraná" },
      degree: { value: "Bacharelado" },
      fieldOfStudy: { value: "Ciência da Computação" },
    });
  });

  it("joins a heading line that wraps onto a lowercase line", () => {
    const [entry] = extractEducation(["Bacharelado em Ciência", "da Computação, PUCRS", "2019 – 2022"]);

    expect(entry).toMatchObject({ institution: { value: "PUCRS" }, degree: { value: "Bacharelado" }, fieldOfStudy: { value: "Ciência da Computação" } });
  });

  it("recognises an acronym as the institution and a bare degree without a field", () => {
    const [entry] = extractEducation(["MBA, FGV", "2020 – 2021"]);

    expect(entry).toMatchObject({ institution: { value: "FGV", confidence: "high" }, degree: { value: "MBA" }, fieldOfStudy: null });
  });

  it("does not read a grade or an exam acronym as the institution", () => {
    const [entry] = extractEducation(["BSc in Physics, GPA 3.8, University of Leeds", "2011 – 2014"]);

    expect(entry).toMatchObject({ institution: { value: "University of Leeds", confidence: "high" }, degree: { value: "BSc" }, fieldOfStudy: { value: "Physics" } });
  });

  it("keeps both parts low when no degree word decides", () => {
    const [entry] = extractEducation(["Universidade de Lisboa | Engenharia de Software", "2015 – 2019"]);

    expect(entry).toEqual({
      institution: { value: "Universidade de Lisboa", confidence: "low" },
      degree: { value: "Engenharia de Software", confidence: "low" },
      fieldOfStudy: null,
      period: { value: { start: "2015-01", end: "2019-12" }, confidence: "high" },
    });
  });

  it("keeps an entry without dates and the heading as institution when nothing else names one", () => {
    const [undated, alone] = extractEducation(["High School Diploma, Lincoln High School", "", "MSc in Physics", "2010 – 2012"]);

    expect(undated).toMatchObject({ institution: { value: "Lincoln High School" }, degree: { value: "High School Diploma" }, period: null });
    expect(alone).toMatchObject({ institution: { value: "MSc in Physics", confidence: "low" }, degree: { value: "MSc" }, fieldOfStudy: { value: "Physics" } });
  });
});
