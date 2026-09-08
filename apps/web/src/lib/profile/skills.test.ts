import type { Skill } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { skillGroupsOf } from "./skills";

const skill = (name: string, category: Skill["category"]): Skill => ({ id: crypto.randomUUID(), name, category });

describe("skillGroupsOf", () => {
  it("groups by the dictionary's categories, in their own order, without the empty ones", () => {
    const groups = skillGroupsOf([
      skill("Docker", "Infrastructure"),
      skill("TypeScript", "Languages & runtimes"),
      skill("NestJS", "Frameworks & data"),
      skill("Go", "Languages & runtimes"),
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Languages & runtimes", "Frameworks & data", "Infrastructure"]);
    expect(groups[0]?.skills.map((entry) => entry.name)).toEqual(["TypeScript", "Go"]);
  });

  it("answers nothing for a Profile with no Skills", () => {
    expect(skillGroupsOf([])).toEqual([]);
  });
});
