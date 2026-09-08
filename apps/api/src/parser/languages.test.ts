import { describe, expect, it } from "vitest";

import { extractLanguages } from "./languages";

describe("extractLanguages", () => {
  it("reads name and level with a CEFR code kept in its parentheses", () => {
    expect(extractLanguages(["Inglês - Fluente (C1)"])).toEqual([
      { name: { value: "Inglês", confidence: "medium" }, level: { value: "Fluente (C1)", confidence: "medium" } },
    ]);
  });

  it("reads the LinkedIn form, the colon form, and one entry per line", () => {
    expect(extractLanguages(["English (Fluent)", "Portuguese: native", "Klingon"]).map((language) => [language.name.value, language.level?.value ?? null])).toEqual([
      ["English", "Fluent"],
      ["Portuguese", "native"],
      ["Klingon", null],
    ]);
  });

  it("splits several languages written on one line", () => {
    expect(extractLanguages(["Português - Nativo; Inglês - Fluente; Espanhol - Intermediário"]).map((language) => language.name.value)).toEqual([
      "Português",
      "Inglês",
      "Espanhol",
    ]);
    expect(extractLanguages(["Inglês (fluente), Espanhol (básico)"]).map((language) => language.level?.value)).toEqual(["fluente", "básico"]);
  });

  it("tells the level words apart from the name when nothing separates them", () => {
    expect(extractLanguages(["Inglês fluente", "Advanced German"])).toEqual([
      { name: { value: "Inglês", confidence: "medium" }, level: { value: "fluente", confidence: "medium" } },
      { name: { value: "German", confidence: "medium" }, level: { value: "Advanced", confidence: "medium" } },
    ]);
  });

  it("leaves the level empty when the rest is not a level and skips prose", () => {
    expect(extractLanguages(["English - Business correspondence", "I have spoken English at work for many years now."])).toEqual([
      { name: { value: "English", confidence: "medium" }, level: null },
    ]);
  });
});
