import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { noUpwardStageImports } from "./no-upward-stage-imports.mjs";

const RULE = "atomic-design/no-upward-stage-imports";
const linter = new Linter();
const config = [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "atomic-design": { rules: { "no-upward-stage-imports": noUpwardStageImports } } },
    rules: { [RULE]: "error" },
    languageOptions: { sourceType: "module", ecmaVersion: "latest" },
  },
];

const component = (stage, name) => `apps/web/src/components/${stage}/${name}/${name}.tsx`;

function messagesFor(source, filename) {
  return linter.verify(source, config, { filename }).filter((message) => message.ruleId === RULE);
}

describe("no-upward-stage-imports", () => {
  it.each([
    ["an atom", "molecules", component("atoms", "button"), 'import { Field } from "../../molecules/field/field";'],
    ["a molecule", "organisms", component("molecules", "field"), 'import { BrandPanel } from "../../organisms/brand-panel/brand-panel";'],
    ["an organism", "templates", component("organisms", "brand-panel"), 'import { AccountTemplate } from "../../templates/account-template/account-template";'],
  ])("rejects %s importing from the %s stage", (_label, stage, filename, source) => {
    const [message] = messagesFor(source, filename);

    expect(message?.message).toContain(`cannot import from the ${stage} stage`);
  });

  it("rejects a component importing another component of the same stage", () => {
    const source = 'import { Label } from "../label/label";';

    expect(messagesFor(source, component("atoms", "button"))[0]?.message).toContain("cannot import another atom");
  });

  it.each([
    ["package path", 'import { BrandPanel } from "@helpmegethired/web/src/components/organisms/brand-panel/brand-panel";', "cannot import from the organisms stage"],
    ["alias", 'import { oneTimeCodeAction } from "@/src/app/(account)/actions";', "cannot import from src/app"],
  ])("rejects a higher stage reached through a %s instead of a relative path", (_label, source, message) => {
    expect(messagesFor(source, component("molecules", "field"))[0]?.message).toContain(message);
  });

  it("rejects a component importing from the pages under src/app", () => {
    const source = 'import { oneTimeCodeAction } from "../../../app/(account)/actions";';

    expect(messagesFor(source, component("organisms", "code-form"))[0]?.message).toContain("cannot import from src/app");
  });

  it.each([
    'export { Button } from "../../atoms/button/button";',
    'const { Button } = await import("../../atoms/button/button");',
    'const { Button } = require("../../atoms/button/button");',
  ])("checks %s the same way as a static import from a higher stage", (source) => {
    expect(messagesFor(source.replace("atoms/button/button", "organisms/brand-panel/brand-panel"), component("molecules", "field"))).toHaveLength(1);
  });

  it.each([
    [component("molecules", "field"), 'import { Label } from "../../atoms/label/label";'],
    [component("organisms", "brand-panel"), 'import { LogoMark } from "../../atoms/logo-mark/logo-mark";'],
    [component("templates", "account-template"), 'import { BrandPanel } from "../../organisms/brand-panel/brand-panel";'],
    [component("molecules", "code-input"), 'import styles from "./code-input.module.css";'],
    [component("molecules", "code-input"), 'import { VERIFICATION_CODE_LENGTH } from "@helpmegethired/shared";'],
    [component("atoms", "button"), 'import { useState } from "react";'],
    [component("organisms", "brand-panel"), 'import { cx } from "../../../lib/class-names";'],
  ])("allows a downward, local, package, or library import in %s", (filename, source) => {
    expect(messagesFor(source, filename)).toHaveLength(0);
  });

  it("ignores files outside src/components", () => {
    const source = 'import { AccountTemplate } from "../../components/templates/account-template/account-template";';

    expect(messagesFor(source, "apps/web/src/app/(account)/layout.tsx")).toHaveLength(0);
  });
});
