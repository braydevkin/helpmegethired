import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RESUME_MAX_PAGES } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { RejectedPdfError } from "./extraction-errors";
import { PdfInspector } from "./pdf-inspector";
import { PDFJS_VERSION } from "./pdfjs-document";
import { PdfjsTextExtractor } from "./pdfjs-text-extractor";

const hostile = (name: string) => readFileSync(join(__dirname, "../../test/fixtures/resumes/hostile", `${name}.pdf`));

describe("PdfInspector", () => {
  const inspector = new PdfInspector();

  it("counts the pages of a readable document", async () => {
    await expect(inspector.inspect(hostile("embedded-javascript"))).resolves.toEqual({ pages: 1 });
    await expect(inspector.inspect(hostile("too-many-pages"))).resolves.toEqual({ pages: RESUME_MAX_PAGES + 1 });
  });

  it.each([
    ["encrypted", "encrypted_pdf"],
    ["malformed-xref", "corrupt_pdf"],
    ["wrong-magic-bytes", "corrupt_pdf"],
  ])("refuses %s as %s", async (name, code) => {
    const refusal = inspector.inspect(hostile(name));

    await expect(refusal).rejects.toThrow(RejectedPdfError);
    await expect(refusal).rejects.toMatchObject({ code });
  });
});

describe("PdfjsTextExtractor", () => {
  const extractor = new PdfjsTextExtractor();

  it("extracts the text of a document without running what it embeds", async () => {
    const { text, extractorVersion } = await extractor.extract(hostile("embedded-javascript"));

    expect(text).toContain("Ada Lovelace - Senior Software Engineer");
    expect(text).not.toContain("hostile");
    expect(extractorVersion).toBe(PDFJS_VERSION);
    expect(extractorVersion).toMatch(/^pdfjs-dist\/\d+\.\d+\.\d+$/);
  });

  it("answers no text for an image-only page", async () => {
    await expect(extractor.extract(hostile("image-only"))).resolves.toMatchObject({ text: expect.stringMatching(/^\s*$/) });
  });

  it("refuses an encrypted document", async () => {
    await expect(extractor.extract(hostile("encrypted"))).rejects.toMatchObject({ code: "encrypted_pdf" });
  });
});
