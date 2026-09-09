import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { people } from "./people.ts";
import { render } from "./templates/index.ts";

const here = dirname(fileURLToPath(import.meta.url));

// Chromium stamps the creation and modification dates into the PDF; pinning them to one
// value of the same length keeps a regenerated file byte for byte equal to the committed one.
const PDF_DATE = /D:\d{14}/gu;
const FIXED_DATE = "D:20260101000000";

const pinDates = (pdf: Buffer): Buffer => Buffer.from(pdf.toString("latin1").replace(PDF_DATE, FIXED_DATE), "latin1");

// Renders every person through its layout into <slug>.pdf beside this script, so a
// regenerated PDF only changes when the data or the template does.
async function generate(): Promise<void> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    for (const person of people) {
      await page.setContent(render(person), { waitUntil: "load" });

      const pdf = pinDates(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));

      writeFileSync(join(here, `${person.slug}.pdf`), pdf);
      process.stdout.write(`${person.slug}.pdf\t${pdf.length} bytes\n`);
    }
  } finally {
    await browser.close();
  }
}

await generate();
