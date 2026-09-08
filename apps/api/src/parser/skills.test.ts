import { describe, expect, it } from "vitest";

import { TECHNOLOGIES } from "./dictionaries/technologies";
import { extractSkills, findTechnologies, skillNamesIn } from "./skills";

describe("technology dictionary", () => {
  it("holds about three hundred terms with a category each", () => {
    expect(TECHNOLOGIES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(TECHNOLOGIES.map((technology) => technology.name)).size).toBe(TECHNOLOGIES.length);
  });

  it("maps every synonym and exact spelling to one technology", () => {
    const keys = TECHNOLOGIES.flatMap((technology) => [...technology.synonyms, ...technology.exact.map((spelling) => `=${spelling}`)]);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("findTechnologies", () => {
  it("folds nodejs, Node.JS, and node into one Node.js under Languages & runtimes", () => {
    const found = findTechnologies("Built services in nodejs; later Node.JS, and node again.");

    expect(found).toEqual([{ name: "Node.js", category: "Languages & runtimes", synonyms: ["node", "nodejs", "node.js"], exact: [] }]);
  });

  it("matches with word boundaries, punctuation, accents, and slashes", () => {
    expect(skillNamesIn("(C#), C++, .NET e Node.js/Express; TCP/IP, CI/CD.")).toEqual(["C#", "C++", ".NET", "Node.js", "Express", "TCP/IP", "CI/CD"]);
    expect(skillNamesIn("Integração contínua com metodologias ágeis")).toEqual(["CI/CD", "Agile"]);
  });

  it("takes the longest term at each position", () => {
    expect(skillNamesIn("Google Cloud Platform and Microsoft SQL Server")).toEqual(["Google Cloud", "SQL Server"]);
    expect(skillNamesIn("React Native and React Testing Library")).toEqual(["React Native", "Testing Library"]);
  });

  it("keeps an ambiguous word only with its exact spelling", () => {
    expect(skillNamesIn("go to the office and express interest in rust")).toEqual(["Rust"]);
    expect(skillNamesIn("Services in Go and Express, analysis in R, firmware in C.")).toEqual(["Go", "Express", "R", "C"]);
  });

  it("ignores technology names hidden inside other words", () => {
    expect(skillNamesIn("javascripting reduxed")).toEqual([]);
  });
});

describe("extractSkills", () => {
  const section = (kind: "skills" | "experience" | "summary", ...lines: string[]) => ({ kind, heading: kind, lines });

  it("is high under a skills heading and medium in prose, listed once", () => {
    const skills = extractSkills([
      section("summary", "Backend engineer working with Python and Kafka."),
      section("experience", "Built the billing service in TypeScript on PostgreSQL."),
      section("skills", "TypeScript, Node.js, Kafka"),
    ]);

    expect(skills).toEqual([
      { name: "Python", category: "Languages & runtimes", confidence: "medium" },
      { name: "Kafka", category: "Frameworks & data", confidence: "high" },
      { name: "TypeScript", category: "Languages & runtimes", confidence: "high" },
      { name: "PostgreSQL", category: "Frameworks & data", confidence: "medium" },
      { name: "Node.js", category: "Languages & runtimes", confidence: "high" },
    ]);
  });
});
