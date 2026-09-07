import { describe, expect, it } from "vitest";

import { TimeoutError } from "../common/with-timeout";
import { ExtractorFailedError, ExtractorUnavailableError, RejectedPdfError } from "./extraction-errors";
import { PopplerTextExtractor, type PopplerSettings } from "./poppler-text-extractor";

const VERSION_ANSWER = 'if (process.argv.includes("-v")) { console.error("pdftotext version 9.9.9"); process.exit(0); }';

const fake = (script: string): PopplerSettings["command"] => ["node", "-e", `${VERSION_ANSWER} ${script}`, "--"];

const echoing = fake("process.stdin.pipe(process.stdout);");
const exiting = (code: number, message = "") => fake(`console.error(${JSON.stringify(message)}); process.exit(${code});`);
const hanging = fake("process.stdin.resume(); setTimeout(() => {}, 60000);");

const extractor = (command: PopplerSettings["command"], timeoutMs = 10_000) =>
  new PopplerTextExtractor({ command, timeoutMs });

const bytes = Buffer.from("%PDF-1.7 pretend");

describe("PopplerTextExtractor", () => {
  it("feeds the bytes to pdftotext and answers its output with the installed version", async () => {
    await expect(extractor(echoing).extract(bytes)).resolves.toEqual({
      text: "%PDF-1.7 pretend",
      extractorVersion: "pdftotext/9.9.9",
    });
  });

  it("reports the installed version once it is probed", async () => {
    await expect(extractor(echoing).versionInstalled()).resolves.toBe("9.9.9");
  });

  it("refuses a document pdftotext cannot open as corrupt", async () => {
    const failure = extractor(exiting(1, "Syntax Error: Couldn't read xref table")).extract(bytes);

    await expect(failure).rejects.toThrow(RejectedPdfError);
    await expect(failure).rejects.toMatchObject({ code: "corrupt_pdf", message: expect.stringContaining("xref table") });
  });

  it.each([
    ["a wrong password", exiting(1, "Command Line Error: Incorrect password")],
    ["a permission error", exiting(3, "Copying of text from this document is not allowed.")],
  ])("refuses a document behind %s as encrypted", async (_label, command) => {
    await expect(extractor(command).extract(bytes)).rejects.toMatchObject({ code: "encrypted_pdf" });
  });

  it("reports any other exit code as its own failure", async () => {
    const failure = extractor(exiting(99, "Internal error")).extract(bytes);

    await expect(failure).rejects.toThrow(ExtractorFailedError);
    await expect(failure).rejects.toThrow("exited with 99: Internal error");
  });

  it("kills a run that outlives the timeout and reports it as such", async () => {
    const started = Date.now();

    await expect(extractor(hanging, 300).extract(bytes)).rejects.toThrow(TimeoutError);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("reports an executable that cannot be started as unavailable", async () => {
    const missing = extractor(["pdftotext-that-is-not-installed"]);

    await expect(missing.versionInstalled()).rejects.toThrow(ExtractorUnavailableError);
    await expect(missing.extract(bytes)).rejects.toThrow(ExtractorUnavailableError);
  });
});
