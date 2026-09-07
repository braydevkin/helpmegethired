import { describe, expect, it } from "vitest";

import { TimeoutError } from "../common/with-timeout";
import { ExtractorFailedError, ExtractorUnavailableError, corruptPdf } from "./extraction-errors";
import { PdfTextExtractor } from "./pdf-text-extractor";
import { PdfjsTextExtractor } from "./pdfjs-text-extractor";
import { PopplerTextExtractor } from "./poppler-text-extractor";
import type { ExtractedText } from "./text-extractor";

const popplerAnswer: ExtractedText = { text: "from poppler", extractorVersion: "pdftotext/9.9.9" };
const fallbackAnswer: ExtractedText = { text: "from pdfjs", extractorVersion: "pdfjs-dist/0.0.0" };

class ScriptedPoppler extends PopplerTextExtractor {
  constructor(private readonly outcome: Error | undefined) {
    super({ command: ["pdftotext"], timeoutMs: 1 });
  }

  override extract(): Promise<ExtractedText> {
    return this.outcome ? Promise.reject(this.outcome) : Promise.resolve(popplerAnswer);
  }
}

class CountingPdfjs extends PdfjsTextExtractor {
  calls = 0;

  override extract(): Promise<ExtractedText> {
    this.calls += 1;

    return Promise.resolve(fallbackAnswer);
  }
}

const bytes = Buffer.from("%PDF-1.7 pretend");

const extractorWhenPoppler = (outcome?: Error) => {
  const fallback = new CountingPdfjs();

  return { extractor: new PdfTextExtractor(new ScriptedPoppler(outcome), fallback), fallback };
};

describe("PdfTextExtractor", () => {
  it("answers pdftotext's text without touching the fallback", async () => {
    const { extractor, fallback } = extractorWhenPoppler();

    await expect(extractor.extract(bytes)).resolves.toEqual(popplerAnswer);
    expect(fallback.calls).toBe(0);
  });

  it.each([
    ["is not installed", new ExtractorUnavailableError("pdftotext", new Error("ENOENT"))],
    ["stops for its own reason", new ExtractorFailedError("pdftotext", "was stopped by SIGSEGV", "")],
  ])("falls back to pdfjs when pdftotext %s", async (_label, outcome) => {
    const { extractor, fallback } = extractorWhenPoppler(outcome);

    await expect(extractor.extract(bytes)).resolves.toEqual(fallbackAnswer);
    expect(fallback.calls).toBe(1);
  });

  it.each([
    ["a refused document", corruptPdf("no trailer")],
    ["a timeout", new TimeoutError("pdftotext", 1)],
  ])("passes %s through instead of retrying in-process", async (_label, outcome) => {
    const { extractor, fallback } = extractorWhenPoppler(outcome);

    await expect(extractor.extract(bytes)).rejects.toBe(outcome);
    expect(fallback.calls).toBe(0);
  });
});
