import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { openApiDocument } from "./document";

export const OPENAPI_FILE = join(__dirname, "../../openapi/openapi.json");

export const renderedDocument = (): string => `${JSON.stringify(openApiDocument(), null, 2)}\n`;

// `--check` answers with exit code 1 when the committed file is not what the code generates,
// which is how the CI lint job keeps the two from drifting.
function main(check: boolean): void {
  const rendered = renderedDocument();

  if (!check) {
    writeFileSync(OPENAPI_FILE, rendered);
    process.stdout.write(`${OPENAPI_FILE} written\n`);

    return;
  }

  const committed = readFileSync(OPENAPI_FILE, "utf8");

  if (committed !== rendered) {
    process.stderr.write(`${OPENAPI_FILE} differs from the generated document; run \`pnpm --filter @helpmegethired/api openapi\`\n`);
    process.exitCode = 1;

    return;
  }

  process.stdout.write(`${OPENAPI_FILE} is up to date\n`);
}

if (require.main === module) {
  main(process.argv.includes("--check"));
}
