import { describe, expect, it } from "vitest";

import { basicProfileFrom, entryIdFrom, experienceFrom } from "./correction-form";

const formOf = (fields: Record<string, string>): FormData => {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }

  return form;
};

const experienceFields = { role: "Senior Backend Engineer", company: "Northwind Labs", periodStart: "2022-03", periodEnd: "", description: "", skills: "" };

describe("basicProfileFrom", () => {
  it("reads the four fields, keeping what was left empty as nothing at all", () => {
    const reading = basicProfileFrom(formOf({ headline: " Backend engineer ", summary: "", linkedinUrl: "", githubUrl: "https://github.com/ada" }));

    expect(reading).toEqual({ ok: true, value: { headline: "Backend engineer", summary: null, linkedinUrl: null, githubUrl: "https://github.com/ada" } });
  });

  it("names the field an address was mistyped in", () => {
    const reading = basicProfileFrom(formOf({ headline: "Backend engineer", summary: "", linkedinUrl: "linkedin.com/in/ada", githubUrl: "" }));

    expect(reading).toEqual({ ok: false, issues: { linkedinUrl: "Give the full address, starting with https://." } });
  });
});

describe("experienceFrom", () => {
  it("reads a role with an open period and its skills", () => {
    const reading = experienceFrom(formOf({ ...experienceFields, description: "Owns payments.", skills: "Node.js, NestJS , " }));

    expect(reading).toEqual({
      ok: true,
      value: {
        role: "Senior Backend Engineer",
        company: "Northwind Labs",
        period: { start: "2022-03", end: null },
        description: "Owns payments.",
        skills: ["Node.js", "NestJS"],
      },
    });
  });

  it("carries no period when neither end was given", () => {
    const reading = experienceFrom(formOf({ ...experienceFields, periodStart: "" }));

    expect(reading).toMatchObject({ ok: true, value: { period: null } });
  });

  it("asks for the month a period started once it has an end", () => {
    const reading = experienceFrom(formOf({ ...experienceFields, periodStart: "", periodEnd: "2024-06" }));

    expect(reading).toEqual({ ok: false, issues: { "period.start": "Give the month it started, as 2022-03." } });
  });

  it("asks for the role a correction left empty", () => {
    const reading = experienceFrom(formOf({ ...experienceFields, role: " " }));

    expect(reading).toEqual({ ok: false, issues: { role: "Name the role this experience was for." } });
  });

  it("refuses a month that is not one", () => {
    const reading = experienceFrom(formOf({ ...experienceFields, periodStart: "March 2022" }));

    expect(reading).toEqual({ ok: false, issues: { "period.start": "Give the month it started, as 2022-03." } });
  });
});

describe("entryIdFrom", () => {
  it("answers the entry being corrected, and nothing for one being added", () => {
    expect(entryIdFrom(formOf({ id: "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c" }))).toBe("2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c");
    expect(entryIdFrom(formOf({}))).toBeNull();
  });
});
