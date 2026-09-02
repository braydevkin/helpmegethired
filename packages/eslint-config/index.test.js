import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { base } from "./index.js";

const CROSS_APP_RULE = "helpmegethired/no-cross-app-imports";
const linter = new Linter();

function ruleIdsFor(source, filename = "apps/web/src/app/page.ts") {
  return linter.verify(source, base, { filename }).map((message) => message.ruleId);
}

describe("cross-application import ban", () => {
  it.each([
    'import { AppModule } from "@helpmegethired/api";',
    'import { scoring } from "@helpmegethired/api/scoring";',
    'import { helper } from "../../../api/src/helper";',
    'import { helper } from "../../../../apps/api/src/helper";',
    'export { helper } from "@helpmegethired/api";',
    'export * from "@helpmegethired/api";',
    'const api = await import("@helpmegethired/api");',
    'const api = require("@helpmegethired/api");',
  ])("rejects %s from apps/web", (source) => {
    expect(ruleIdsFor(source)).toContain(CROSS_APP_RULE);
  });

  it("rejects an app import from a shared package", () => {
    const source = 'import { AppModule } from "@helpmegethired/api";';
    expect(ruleIdsFor(source, "packages/shared/src/index.ts")).toContain(CROSS_APP_RULE);
  });

  it.each([
    'import { CandidateSchema } from "@helpmegethired/shared";',
    'import { CandidateSchema } from "@helpmegethired/shared/candidate";',
    'import { Layout } from "@helpmegethired/web/layout";',
    'import { helper } from "./helper";',
    'import { helper } from "../../lib/helper";',
    'import { readFile } from "node:fs/promises";',
  ])("allows %s from apps/web", (source) => {
    expect(ruleIdsFor(source)).not.toContain(CROSS_APP_RULE);
  });
});

describe("base configuration", () => {
  it("parses TypeScript syntax", () => {
    expect(ruleIdsFor("export const count: number = 1;")).toEqual([]);
  });

  it("applies the recommended TypeScript rules", () => {
    expect(ruleIdsFor("export const value: any = 1;")).toContain(
      "@typescript-eslint/no-explicit-any",
    );
  });
});
