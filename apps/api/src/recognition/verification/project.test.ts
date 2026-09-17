import { describe, expect, it } from "vitest";

import { extractProjects } from "../../parser";
import { verifyProject } from "./project";

const quoted = (value: string, quote = value) => ({ value, quote });

describe("verifyProject", () => {
  const lines = ["Difference Engine — https://github.com/ada-example/difference-engine", "A mechanical calculator simulator in Rust with a Svelte front end."];
  const byRules = { projects: extractProjects(lines) };

  it("confirms the URL and the name both readings found, and adds the skills the Model read", () => {
    const [project] = verifyProject(lines, byRules, {
      projects: [
        {
          name: quoted("Difference Engine"),
          description: quoted("A mechanical calculator simulator in Rust with a Svelte front end."),
          url: quoted("https://github.com/ada-example/difference-engine/", "github.com/ada-example/difference-engine"),
          skills: [quoted("Rust"), quoted("mechanical calculator")],
        },
      ],
    }).projects;

    expect(project).toEqual({
      name: { value: "Difference Engine", confidence: "high" },
      description: { value: "A mechanical calculator simulator in Rust with a Svelte front end.", confidence: "high" },
      url: { value: "https://github.com/ada-example/difference-engine", confidence: "high" },
      skills: ["Rust", "Svelte", "mechanical calculator"],
    });
  });

  it("keeps a URL only the Model read at high when it is written in its quote, and medium when it is not", () => {
    const withoutLink = ["Difference Engine", "Source at gitlab.com/ada/engine, mirrored on the lab site."];
    const rules = { projects: [{ name: { value: "Difference Engine", confidence: "high" as const }, description: null, url: null, skills: [] }] };
    const read = (url: string, quote: string) =>
      verifyProject(withoutLink, rules, { projects: [{ name: quoted("Difference Engine"), description: null, url: quoted(url, quote), skills: [] }] }).projects[0]?.url;

    expect(read("https://gitlab.com/ada/engine", "gitlab.com/ada/engine")).toEqual({ value: "https://gitlab.com/ada/engine", confidence: "high" });
    expect(read("https://lab.example/engine", "mirrored on the lab site")).toEqual({ value: "https://lab.example/engine", confidence: "medium" });
  });
});
