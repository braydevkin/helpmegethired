import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ProfileDraftSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { parseResume } from "./parse-resume";

const corpus = join(__dirname, "../../test/fixtures/resumes/corpus");
const cases = readdirSync(corpus)
  .filter((name) => name.endsWith(".txt"))
  .map((name) => name.replace(/\.txt$/u, ""))
  .sort();

// Every fixture's text goes through the parser and is compared with the JSON committed under
// expected/. A rule change that alters an outcome updates that file on purpose, in the same
// pull request, with `vitest run -u`.
describe("synthetic corpus", () => {
  it("holds the first batch", () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(cases)("%s parses as expected", async (slug) => {
    const parsed = parseResume(readFileSync(join(corpus, `${slug}.txt`), "utf8"));

    expect(ProfileDraftSchema.parse(parsed.draft)).toEqual(parsed.draft);
    await expect(`${JSON.stringify(parsed, null, 2)}\n`).toMatchFileSnapshot(join(corpus, "expected", `${slug}.json`));
  });
});
