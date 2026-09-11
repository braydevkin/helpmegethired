import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CROSS_CUTTING_TITLE, SYNTHESIS_TITLE, unitsOf } from "./curation-units";

const experience = (role: string, company: string | null) => ({ id: randomUUID(), role, company });

describe("unitsOf", () => {
  it("gives each Experience and Project a unit, then the cross-cutting unit, and the synthesis unit last", () => {
    const experiences = [experience("Senior Platform Engineer", "Parapet Systems"), experience("Platform Engineer", "Glacis Labs")];
    const projects = [{ id: randomUUID(), name: "Bastion" }];

    expect(unitsOf({ experiences, projects })).toEqual([
      { kind: "experience", position: 0, subjectId: experiences[0]?.id, title: "Senior Platform Engineer at Parapet Systems" },
      { kind: "experience", position: 1, subjectId: experiences[1]?.id, title: "Platform Engineer at Glacis Labs" },
      { kind: "project", position: 2, subjectId: projects[0]?.id, title: "Bastion" },
      { kind: "cross_cutting", position: 3, subjectId: null, title: CROSS_CUTTING_TITLE },
      { kind: "synthesis", position: 4, subjectId: null, title: SYNTHESIS_TITLE },
    ]);
  });

  it("names a role with no company by the role alone", () => {
    expect(unitsOf({ experiences: [experience("Consultant", null)], projects: [] })[0]?.title).toBe("Consultant");
  });

  it("caps nothing: twenty Experiences and no Project are twenty-two units", () => {
    const units = unitsOf({ experiences: Array.from({ length: 20 }, (_, index) => experience(`Role ${index}`, "Rampart Cloud")), projects: [] });

    expect(units).toHaveLength(22);
    expect(units.map((unit) => unit.position)).toEqual([...units.keys()]);
    expect(units.at(-1)?.kind).toBe("synthesis");
  });

  it("still curates a Profile with neither, through the cross-cutting and synthesis units", () => {
    expect(unitsOf({ experiences: [], projects: [] }).map((unit) => unit.kind)).toEqual(["cross_cutting", "synthesis"]);
  });
});
