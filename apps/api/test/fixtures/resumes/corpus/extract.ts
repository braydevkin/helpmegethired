import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The text the parser is tested against is what the worker's extractor produces: pdftotext
// with the layout kept. Run it where poppler is installed; the version goes to the manifest.
function version(): string {
  const probe = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });

  if (probe.error) {
    throw new Error("pdftotext is not installed; install poppler-utils or run this script in the API image");
  }

  return /pdftotext version (\S+)/u.exec(`${probe.stderr}${probe.stdout}`)?.[1] ?? "unknown";
}

function extract(pdf: string): string {
  const run = spawnSync("pdftotext", ["-layout", join(here, pdf), "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

  if (run.status !== 0) {
    throw new Error(`pdftotext failed on ${pdf}: ${run.stderr}`);
  }

  return run.stdout;
}

const extractorVersion = `pdftotext/${version()}`;
const pdfs = readdirSync(here)
  .filter((name) => name.endsWith(".pdf"))
  .sort();

for (const pdf of pdfs) {
  const text = extract(pdf);
  const target = pdf.replace(/\.pdf$/u, ".txt");

  writeFileSync(join(here, target), text);
  process.stdout.write(`${target}\t${text.length} characters\n`);
}

writeFileSync(join(here, "manifest.json"), `${JSON.stringify({ extractorVersion, files: pdfs }, null, 2)}\n`);
process.stdout.write(`manifest.json\t${extractorVersion}\n`);
