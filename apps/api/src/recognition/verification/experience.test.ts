import type { DraftExperience, SegmentRecognition } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { extractExperiences, withSkills } from "../../parser";
import { verifyExperience } from "./experience";

type ExperienceByModel = SegmentRecognition<"experience">["experiences"][number];

const lines = [
  "Senior Backend Engineer | Analytical Engines Ltd",
  "London · Mar 2021 – Present",
  "Own the ingestion platform on PostgreSQL.",
  "Cut the median processing time with Temporalite.",
];

const quoted = (value: string, quote = value) => ({ value, quote });

const modelEntry = (overrides: Partial<ExperienceByModel> = {}): ExperienceByModel => ({
  role: quoted("Senior Backend Engineer"),
  company: quoted("Analytical Engines Ltd"),
  period: { start: "2021-03", end: null, quote: "Mar 2021 – Present" },
  description: quoted(
    "Own the ingestion platform on PostgreSQL. Cut the median processing time with Temporalite.",
    "Own the ingestion platform on PostgreSQL.\nCut the median processing time with Temporalite.",
  ),
  skills: [],
  ...overrides,
});

const byRulesOf = (experiences: DraftExperience[]) => ({ experiences });
const byModelOf = (experiences: ExperienceByModel[]) => ({ experiences });

describe("verifyExperience", () => {
  it("raises every field both readings agree on to high and keeps the rules' values", () => {
    const byRules = byRulesOf(extractExperiences(lines).map(withSkills));
    const [experience] = verifyExperience(lines, byRules, byModelOf([modelEntry()])).experiences;

    expect(experience).toEqual({
      ...byRules.experiences[0],
      role: { value: "Senior Backend Engineer", confidence: "high" },
      company: { value: "Analytical Engines Ltd", confidence: "high" },
      period: { value: { start: "2021-03", end: null }, confidence: "high" },
      description: { value: "Own the ingestion platform on PostgreSQL.\nCut the median processing time with Temporalite.", confidence: "high" },
    });
  });

  it("fills the company, the period, and the description the rules missed, and flags the role they read differently", () => {
    const byRules = byRulesOf([{ role: { value: "Analytical Engines Ltd", confidence: "low" }, company: null, period: null, description: null, skills: [] }]);
    const [experience] = verifyExperience(lines, byRules, byModelOf([modelEntry()])).experiences;

    expect(experience).toEqual({
      role: { value: "Senior Backend Engineer", confidence: "low" },
      company: { value: "Analytical Engines Ltd", confidence: "medium" },
      period: { value: { start: "2021-03", end: null }, confidence: "high" },
      description: { value: "Own the ingestion platform on PostgreSQL. Cut the median processing time with Temporalite.", confidence: "medium" },
      skills: ["PostgreSQL"],
    });
  });

  it("keeps the rules' period at low when the Model read another one", () => {
    const [ruled] = extractExperiences(lines).map(withSkills);
    const byRules = byRulesOf([{ ...ruled!, period: { value: { start: "2019-01", end: null }, confidence: "high" } }]);

    expect(verifyExperience(lines, byRules, byModelOf([modelEntry()])).experiences[0]?.period).toEqual({ value: { start: "2019-01", end: null }, confidence: "low" });
  });

  it("pairs the Model's Experience with a rules entry whose heading is a bullet, by the lines both cover", () => {
    const byRules = byRulesOf([
      {
        role: { value: "Own the ingestion platform on PostgreSQL.", confidence: "low" },
        company: null,
        period: null,
        description: { value: "Cut the median processing time with Temporalite.", confidence: "high" },
        skills: [],
      },
    ]);
    const { experiences } = verifyExperience(lines, byRules, byModelOf([modelEntry()]));

    expect(experiences).toHaveLength(1);
    expect(experiences[0]).toMatchObject({
      role: { value: "Senior Backend Engineer", confidence: "low" },
      company: { value: "Analytical Engines Ltd", confidence: "medium" },
      period: { value: { start: "2021-03", end: null }, confidence: "high" },
    });
  });

  it("does not pair entries that share neither words nor lines", () => {
    const byRules = byRulesOf([
      { role: { value: "Senior Backend Engineer", confidence: "high" }, company: null, period: null, description: null, skills: [] },
    ]);
    const byModel = byModelOf([modelEntry({ role: quoted("Cut the median processing time with Temporalite."), company: null, period: null, description: null })]);

    expect(verifyExperience(lines, byRules, byModel).experiences).toEqual([
      { role: { value: "Cut the median processing time with Temporalite.", confidence: "medium" }, company: null, period: null, description: null, skills: [] },
    ]);
  });

  it("discards a value whose quote the Segment never says and keeps the rules' field", () => {
    const byRules = byRulesOf(extractExperiences(lines).map(withSkills));
    const byModel = byModelOf([modelEntry({ company: quoted("Babbage Corp") })]);

    expect(verifyExperience(lines, byRules, byModel).experiences[0]?.company).toEqual({ value: "Analytical Engines Ltd", confidence: "high" });
  });

  it("drops a Model entry whose role is not in the Segment, and with it the rules' entry it would have verified", () => {
    const byRules = byRulesOf(extractExperiences(lines).map(withSkills));
    const byModel = byModelOf([modelEntry({ role: quoted("Chief Technology Officer") })]);

    expect(verifyExperience(lines, byRules, byModel)).toEqual({ experiences: [] });
  });

  it("keeps an Experience only the Model read, high where a rule confirms it", () => {
    const [experience] = verifyExperience(lines, byRulesOf([]), byModelOf([modelEntry({ description: null })])).experiences;

    expect(experience).toEqual({
      role: { value: "Senior Backend Engineer", confidence: "high" },
      company: { value: "Analytical Engines Ltd", confidence: "medium" },
      period: { value: { start: "2021-03", end: null }, confidence: "high" },
      description: null,
      skills: [],
    });
  });

  it("leaves out an Experience only the rules read", () => {
    const byRules = byRulesOf(extractExperiences(lines).map(withSkills));

    expect(byRules.experiences).toHaveLength(1);
    expect(verifyExperience(lines, byRules, byModelOf([]))).toEqual({ experiences: [] });
  });

  it("adds the Model's skills that are in the Segment, a known one under its canonical name", () => {
    const byRules = byRulesOf(extractExperiences(lines).map(withSkills));
    const byModel = byModelOf([modelEntry({ skills: [quoted("postgres", "PostgreSQL"), quoted("Temporalite"), quoted("Kubernetes")] })]);

    expect(verifyExperience(lines, byRules, byModel).experiences[0]?.skills).toEqual(["PostgreSQL", "Temporalite"]);
  });
});
