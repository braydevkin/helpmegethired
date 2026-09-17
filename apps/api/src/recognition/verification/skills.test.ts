import { describe, expect, it } from "vitest";

import { extractSkills, splitSections } from "../../parser";
import { verifySkills } from "./skills";

const quoted = (value: string, quote = value) => ({ value, quote });

describe("verifySkills", () => {
  const lines = ["SKILLS", "", "TypeScript, NodeJS, Temporalite", "", "EXPERIENCE", "", "Engineer | Acme", "2020 – 2022", "Ran PostgreSQL in production."];
  const byRules = { skills: extractSkills(splitSections(lines)) };

  it("names a known skill by the dictionary at high and confirms one the rules found only in prose", () => {
    expect(byRules.skills).toContainEqual({ name: "PostgreSQL", category: "Frameworks & data", confidence: "medium" });

    const { skills } = verifySkills(lines, byRules, {
      skills: [
        { name: quoted("Node", "NodeJS"), category: "Other" },
        { name: quoted("PostgreSQL"), category: "Frameworks & data" },
      ],
    });

    expect(skills).toContainEqual({ name: "Node.js", category: "Languages & runtimes", confidence: "high" });
    expect(skills).toContainEqual({ name: "PostgreSQL", category: "Frameworks & data", confidence: "high" });
    expect(skills.filter((skill) => skill.name === "Node.js")).toHaveLength(1);
  });

  it("keeps a skill the dictionary does not know with the Model's category at medium", () => {
    const { skills } = verifySkills(lines, byRules, { skills: [{ name: quoted("Temporalite"), category: "Infrastructure" }] });

    expect(skills).toContainEqual({ name: "Temporalite", category: "Infrastructure", confidence: "medium" });
  });

  it("keeps C, C++, and C# apart", () => {
    const languages = ["SKILLS", "", "C, C++, C#"];
    const rules = { skills: extractSkills(splitSections(languages)) };
    const { skills } = verifySkills(languages, rules, {
      skills: [
        { name: quoted("C#"), category: "Languages & runtimes" },
        { name: quoted("C++"), category: "Languages & runtimes" },
        { name: quoted("C"), category: "Languages & runtimes" },
      ],
    });

    expect(skills.map((skill) => skill.name)).toEqual(["C", "C++", "C#"]);
  });

  it("finds no technology inside another word, nor one its quote does not name", () => {
    const cloud = ["SKILLS", "", "Google Cloud, TypeScript"];
    const rules = { skills: extractSkills(splitSections(cloud)) };
    const { skills } = verifySkills(cloud, rules, {
      skills: [
        { name: quoted("Go"), category: "Languages & runtimes" },
        { name: quoted("Kubernetes", "TypeScript"), category: "Infrastructure" },
      ],
    });

    expect(skills).toEqual([{ name: "TypeScript", category: "Languages & runtimes", confidence: "high" }]);
  });

  it("does not raise a skill only the Model read because it read it twice", () => {
    const { skills } = verifySkills(lines, byRules, {
      skills: [
        { name: quoted("Temporalite"), category: "Infrastructure" },
        { name: quoted("temporalite", "Temporalite"), category: "Infrastructure" },
      ],
    });

    expect(skills.filter((skill) => skill.name === "Temporalite")).toEqual([{ name: "Temporalite", category: "Infrastructure", confidence: "medium" }]);
  });

  it("discards a skill the Segment never names and leaves out every skill only the rules found", () => {
    const { skills } = verifySkills(lines, byRules, { skills: [{ name: quoted("Kubernetes"), category: "Infrastructure" }] });

    expect(byRules.skills.length).toBeGreaterThan(0);
    expect(skills).toEqual([]);
  });

  it("keeps the rules' order for the skills both read, with the ones only the Model read after them", () => {
    const { skills } = verifySkills(lines, byRules, {
      skills: [
        { name: quoted("Temporalite"), category: "Infrastructure" },
        { name: quoted("PostgreSQL"), category: "Frameworks & data" },
        { name: quoted("TypeScript"), category: "Languages & runtimes" },
      ],
    });

    expect(skills.map((skill) => skill.name)).toEqual(["TypeScript", "PostgreSQL", "Temporalite"]);
  });
});
