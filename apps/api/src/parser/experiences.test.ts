import { describe, expect, it } from "vitest";

import { extractExperiences } from "./experiences";

describe("extractExperiences", () => {
  it("starts an entry at each date line, reads the heading from the line before it, and keeps the rest as the description", () => {
    const [first, second] = extractExperiences([
      "Senior Backend Engineer | Analytical Engines Ltd",
      "London · Mar 2021 – Present",
      "Own the ingestion platform.",
      "Cut the median processing time from 40 seconds to 6.",
      "Backend Engineer | Difference Works",
      "Manchester · Jun 2016 – Feb 2021",
      "Built the billing service.",
    ]);

    expect(first).toEqual({
      role: { value: "Senior Backend Engineer", confidence: "high" },
      company: { value: "Analytical Engines Ltd", confidence: "high" },
      period: { value: { start: "2021-03", end: null }, confidence: "high" },
      description: { value: "Own the ingestion platform.\nCut the median processing time from 40 seconds to 6.", confidence: "high" },
      skills: [],
    });
    expect(second).toMatchObject({
      role: { value: "Backend Engineer" },
      company: { value: "Difference Works" },
      period: { value: { start: "2016-06", end: "2021-02" } },
      description: { value: "Built the billing service." },
    });
  });

  it("keeps a heading that ends with a company abbreviation", () => {
    const [entry] = extractExperiences(["Engineer | Acme", "2019 - 2021", "Shipped it.", "Backend Engineer | Difference Works Ltd.", "2021 - 2023"]);
    const second = extractExperiences(["Engineer | Acme", "2019 - 2021", "Shipped it.", "Backend Engineer | Difference Works Ltd.", "2021 - 2023"])[1];

    expect(entry?.description?.value).toBe("Shipped it.");
    expect(second).toMatchObject({ role: { value: "Backend Engineer" }, company: { value: "Difference Works Ltd." } });
  });

  it("finds the title on either side of the separator with high confidence", () => {
    const [pipe, comma] = extractExperiences(["Senior Engineer | Acme", "2019 - 2021", "", "Acme, Senior Engineer", "2017 - 2019"]);

    expect(pipe).toMatchObject({ role: { value: "Senior Engineer", confidence: "high" }, company: { value: "Acme", confidence: "high" } });
    expect(comma).toMatchObject({ role: { value: "Senior Engineer", confidence: "high" }, company: { value: "Acme", confidence: "high" } });
  });

  it("keeps both parts raw with low confidence when no part carries a title word", () => {
    const [entry] = extractExperiences(["Acme | Globex Division", "2019 - 2021"]);

    expect(entry).toMatchObject({ role: { value: "Acme", confidence: "low" }, company: { value: "Globex Division", confidence: "low" } });
  });

  it("reads a two-line heading as the LinkedIn export lays it out", () => {
    const [entry] = extractExperiences(["Northwind Systems", "Engineering Manager", "October 2020 – Present", "Berlin", "Lead the platform team."]);

    expect(entry).toMatchObject({
      role: { value: "Engineering Manager", confidence: "high" },
      company: { value: "Northwind Systems", confidence: "high" },
      description: { value: "Berlin\nLead the platform team." },
    });
  });

  it("reads the heading from the date line itself when the dates come first", () => {
    const [entry] = extractExperiences(["2019 – Atual Engenheiro de Dados Sênior, Pinheiro Analytics, Curitiba", "Lidera a plataforma de dados."]);

    expect(entry).toMatchObject({
      role: { value: "Engenheiro de Dados Sênior", confidence: "high" },
      company: { value: "Pinheiro Analytics", confidence: "high" },
      period: { value: { start: "2019-01", end: null } },
    });
  });

  it("marks an open-ended entry as held by leaving its end empty", () => {
    const [entry] = extractExperiences(["Staff Engineer at Acme", "Since May 2019"]);

    expect(entry?.period).toEqual({ value: { start: "2019-05", end: null }, confidence: "high" });
  });

  it("keeps a block without dates as an entry with no period", () => {
    const [entry] = extractExperiences(["Volunteer Developer, Code Club", "Teach children to program on Saturdays."]);

    expect(entry).toMatchObject({
      role: { value: "Volunteer Developer", confidence: "high" },
      company: { value: "Code Club", confidence: "high" },
      period: null,
      description: { value: "Teach children to program on Saturdays." },
    });
  });

  it("opens an entry without dates at a role and company line that follows a sentence", () => {
    const [dated, volunteer] = extractExperiences([
      "Mobile Engineer | Harbour Media",
      "Vancouver · August 2018 – January 2022",
      "Built the news app for iOS in Swift.",
      "Volunteer Instructor | Code Club Vancouver",
      "Vancouver",
      "Teach children to program on Saturdays.",
    ]);

    expect(dated?.description?.value).toBe("Built the news app for iOS in Swift.");
    expect(volunteer).toMatchObject({
      role: { value: "Volunteer Instructor", confidence: "high" },
      company: { value: "Code Club Vancouver", confidence: "high" },
      period: null,
      description: { value: "Vancouver\nTeach children to program on Saturdays." },
    });
  });

  it("never takes a sentence of the previous description as the next heading", () => {
    const [first, second] = extractExperiences([
      "Engineer | Acme",
      "2019 - 2021",
      "Shipped the thing.",
      "Kept the tests green and the pager quiet.",
      "2017 - 2019",
    ]);

    expect(first?.description?.value).toBe("Shipped the thing.\nKept the tests green and the pager quiet.");
    expect(second).toBeUndefined();
  });

  it("answers nothing for an empty section", () => {
    expect(extractExperiences([])).toEqual([]);
  });
});

describe("extractExperiences after a bullet ending in a short capitalised word", () => {
  it("keeps the bullet in the description instead of reading it as the next heading", () => {
    const [first, second] = extractExperiences(["Feb 2021 – Present Site Reliability Engineer, Rhône Payments", "Wrote the incident tooling in Go.", "Sep 2017 – Jan 2021 DevOps Engineer, Presqu'île Hosting"]);

    expect(first?.description?.value).toBe("Wrote the incident tooling in Go.");
    expect(second).toMatchObject({ role: { value: "DevOps Engineer" }, company: { value: "Presqu'île Hosting" } });
  });
});
