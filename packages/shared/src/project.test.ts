import { describe, expect, it } from "vitest";

import { project } from "./candidate.fixtures.js";
import { ProjectSchema } from "./project.js";

describe("ProjectSchema", () => {
  it("accepts a project with a link and skills", () => {
    expect(ProjectSchema.safeParse(project).success).toBe(true);
  });

  it("accepts a project without a link or a description", () => {
    expect(ProjectSchema.safeParse({ ...project, url: null, description: null }).success).toBe(true);
  });

  it.each([
    ["a blank name", { ...project, name: "" }],
    ["a link that is not a URL", { ...project, url: "github.com/ada" }],
  ])("rejects %s", (_label, input) => {
    expect(ProjectSchema.safeParse(input).success).toBe(false);
  });
});
