import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { cappedInput, sourcesOf, type UnitSubjects } from "./unit-input";

const subjects: UnitSubjects = {
  experiences: [
    { id: randomUUID(), role: "Senior Platform Engineer", company: "Parapet Systems", description: "Runs the deployment platform." },
    { id: randomUUID(), role: "Consultant", company: null, description: null },
  ],
  projects: [{ id: randomUUID(), name: "Bastion", description: "Rotates database credentials." }],
};

describe("sourcesOf", () => {
  it("gives an Experience unit its own Experience only, titled by role and company", () => {
    expect(sourcesOf({ kind: "experience", subjectId: subjects.experiences[0]!.id }, subjects)).toEqual([
      { kind: "experience", referenceId: subjects.experiences[0]!.id, title: "Senior Platform Engineer at Parapet Systems", text: "Runs the deployment platform." },
    ]);
  });

  it("gives a Project unit its own Project only", () => {
    expect(sourcesOf({ kind: "project", subjectId: subjects.projects[0]!.id }, subjects).map((source) => source.title)).toEqual(["Bastion"]);
  });

  it.each(["cross_cutting", "synthesis"] as const)("gives the %s unit every Experience and Project", (kind) => {
    expect(sourcesOf({ kind, subjectId: null }, subjects).map((source) => [source.kind, source.title, source.text])).toEqual([
      ["experience", "Senior Platform Engineer at Parapet Systems", "Runs the deployment platform."],
      ["experience", "Consultant", ""],
      ["project", "Bastion", "Rotates database credentials."],
    ]);
  });
});

describe("cappedInput", () => {
  const source = (title: string, text: string) => ({ kind: "experience" as const, referenceId: randomUUID(), title, text });

  it("keeps every source that fits, untruncated", () => {
    const sources = [source("Role", "One line.\nTwo lines.")];

    expect(cappedInput(sources, 100)).toEqual({ sources, truncated: false });
  });

  it("cuts the source that crosses the cap at its last line boundary, and drops the rest", () => {
    const first = source("Role", "Line one.\nLine two.\nLine three.");
    const { sources, truncated } = cappedInput([first, source("Other", "Never read.")], 4 + 22);

    expect(truncated).toBe(true);
    expect(sources).toEqual([{ ...first, text: "Line one.\nLine two." }]);
  });

  it("cuts a single line longer than the cap at its last word, rather than dropping it", () => {
    const paragraph = source("Role", "Runs the deployment platform for forty product teams across three regions");
    const { sources, truncated } = cappedInput([paragraph], 4 + 30);

    expect(truncated).toBe(true);
    expect(sources[0]?.text).toBe("Runs the deployment platform");
  });

  it("counts titles against the cap", () => {
    const { sources, truncated } = cappedInput([source("A title longer than the cap", "text")], 10);

    expect(truncated).toBe(true);
    expect(sources).toEqual([]);
  });

  it("caps at 8,000 characters by default", () => {
    const long = source("Role", Array.from({ length: 1000 }, (_, index) => `Line ${index} of a very long description.`).join("\n"));
    const { sources, truncated } = cappedInput([long]);

    expect(truncated).toBe(true);
    expect((sources[0]?.title.length ?? 0) + (sources[0]?.text.length ?? 0)).toBeLessThanOrEqual(8000);
    expect(long.text.startsWith(sources[0]?.text ?? "")).toBe(true);
    expect(sources[0]?.text.endsWith(".")).toBe(true);
  });
});
