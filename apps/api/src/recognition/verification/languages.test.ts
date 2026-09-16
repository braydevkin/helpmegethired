import { describe, expect, it } from "vitest";

import { extractLanguages } from "../../parser";
import { verifyLanguages } from "./languages";

const quoted = (value: string, quote = value) => ({ value, quote });

describe("verifyLanguages", () => {
  const lines = ["English - Native", "French - Intermediate (B1)", "Some Portuguese"];
  const byRules = { languages: extractLanguages(lines) };

  it("raises the languages both readings agree on and confirms a level only the Model read by the dictionary", () => {
    const { languages } = verifyLanguages(lines, byRules, {
      languages: [
        { name: quoted("French"), level: quoted("Intermediate (B1)") },
        { name: quoted("English"), level: quoted("Native") },
      ],
    });

    expect(languages.slice(0, 2)).toEqual([
      { name: { value: "English", confidence: "high" }, level: { value: "Native", confidence: "high" } },
      { name: { value: "French", confidence: "high" }, level: { value: "Intermediate (B1)", confidence: "high" } },
    ]);
  });

  it("pairs languages listed on one line by name, whatever order the Model returns them in", () => {
    const oneLine = ["Português (nativo), Inglês (fluente), Espanhol (básico)"];
    const rules = { languages: extractLanguages(oneLine) };
    const { languages } = verifyLanguages(oneLine, rules, {
      languages: [
        { name: quoted("Espanhol"), level: quoted("básico") },
        { name: quoted("Inglês"), level: quoted("fluente") },
        { name: quoted("Português"), level: quoted("nativo") },
      ],
    });

    expect(languages.map((language) => [language.name.value, language.level?.value, language.name.confidence])).toEqual([
      ["Português", "nativo", "high"],
      ["Inglês", "fluente", "high"],
      ["Espanhol", "básico", "high"],
    ]);
  });

  it("takes the Model's name at low when the rules read it differently, and keeps the rules' entries it did not return", () => {
    const { languages } = verifyLanguages(lines, byRules, { languages: [{ name: quoted("Portuguese"), level: quoted("Some") }] });

    expect(languages).toEqual([
      ...byRules.languages.slice(0, 2),
      { name: { value: "Portuguese", confidence: "low" }, level: { value: "Some", confidence: "medium" } },
    ]);
  });
});
