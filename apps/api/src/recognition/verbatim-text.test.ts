import { describe, expect, it } from "vitest";

import { VerbatimText } from "./verbatim-text";

describe("VerbatimText", () => {
  const source = new VerbatimText("Senior Backend Engineer | Análise   Ltda\nBuilt the billing service in TypeScript/PostgreSQL.\n  Let's go to JavaScript Go meetups.");

  describe("spanOf", () => {
    it.each([
      ["another case", "senior backend engineer", "Senior Backend Engineer"],
      ["no accents", "Analise Ltda", "Análise   Ltda"],
      ["a slash read as a space", "TypeScript PostgreSQL", "TypeScript/PostgreSQL"],
      ["a line break read as a space", "Ltda Built", "Ltda\nBuilt"],
    ])("finds a value written with %s and answers the text as written", (_label, needle, verbatim) => {
      const span = source.spanOf(needle);

      expect(span && source.sliceOf(span)).toBe(verbatim);
    });

    it("matches whole words only", () => {
      expect(source.spanOf("Java")).toBeUndefined();
      expect(source.spanOf("Script")).toBeUndefined();
    });

    it("keeps the casing when asked, so the language is not the verb", () => {
      const span = source.spanOf("Go", { matchCase: true });

      expect(span && source.text.slice(span.start - 11, span.end)).toBe("JavaScript Go");
    });

    it("searches from the given offset", () => {
      const text = new VerbatimText("Engineer at A\nEngineer at B");
      const second = text.spanOf("Engineer", { from: 1 });

      expect(second?.start).toBe(14);
    });

    it("finds nothing for a value the text never holds, or an empty one", () => {
      expect(source.spanOf("Kubernetes")).toBeUndefined();
      expect(source.spanOf("  ")).toBeUndefined();
    });
  });

  describe("quoteOf", () => {
    it("quotes a value found whole", () => {
      expect(source.quoteOf("the billing service")).toBe("the billing service");
    });

    it("quotes a value the rules tidied from its opening words to its closing words", () => {
      const project = new VerbatimText("A simulator (https://example.com/engine) for polynomial functions.");

      expect(project.quoteOf("A simulator for polynomial functions.")).toBe("A simulator (https://example.com/engine) for polynomial functions.");
    });

    it("quotes nothing when the value's words are not all there", () => {
      expect(source.quoteOf("Senior Frontend Engineer")).toBeUndefined();
      expect(source.quoteOf("Staff")).toBeUndefined();
    });
  });

  describe("urlQuoteOf", () => {
    it("quotes a link written without its scheme", () => {
      const header = new VerbatimText("linkedin.com/in/ada-example · github.com/ada-example");

      expect(header.urlQuoteOf("https://github.com/ada-example")).toBe("github.com/ada-example");
    });

    it("quotes a link written with its scheme", () => {
      expect(new VerbatimText("See https://example.com/engine.").urlQuoteOf("https://example.com/engine")).toBe("https://example.com/engine");
    });
  });
});
