import { describe, expect, it } from "vitest";

import { extractProjects } from "./projects";

describe("extractProjects", () => {
  it("reads a name line with its link, then the description, and matches the skills", () => {
    const [project] = extractProjects([
      "Difference Engine — https://github.com/ada-example/difference-engine",
      "A mechanical calculator for polynomial functions, rebuilt as a web simulator in TypeScript.",
    ]);

    expect(project).toEqual({
      name: { value: "Difference Engine", confidence: "high" },
      description: { value: "A mechanical calculator for polynomial functions, rebuilt as a web simulator in TypeScript.", confidence: "high" },
      url: { value: "https://github.com/ada-example/difference-engine", confidence: "high" },
      skills: ["TypeScript"],
    });
  });

  it("takes a link on its own line and a link in parentheses out of the description", () => {
    const [moth, accessible] = extractProjects([
      "Moth",
      "A tiny bug tracker that lives in the repository.",
      "https://github.com/gracebh-example/moth",
      "",
      "Acessível · Extensão de navegador que aponta problemas de contraste. (https://github.com/julialima-example/acessivel)",
    ]);

    expect(moth).toMatchObject({ name: { value: "Moth" }, description: { value: "A tiny bug tracker that lives in the repository." }, url: { value: "https://github.com/gracebh-example/moth" } });
    expect(accessible).toMatchObject({
      name: { value: "Acessível" },
      description: { value: "Extensão de navegador que aponta problemas de contraste." },
      url: { value: "https://github.com/julialima-example/acessivel" },
    });
  });

  it("opens a new project at a capitalised short line after a sentence", () => {
    const projects = extractProjects(["Fila Zero", "Aplicativo de senhas feito em React.", "Mapa Vivo", "Mapa colaborativo com Leaflet e Node.js."]);

    expect(projects.map((project) => project.name.value)).toEqual(["Fila Zero", "Mapa Vivo"]);
    expect(projects[1]?.skills).toEqual(["Node.js"]);
  });

  it("splits dated projects at the date lines and drops a block with no name", () => {
    const projects = extractProjects(["Tile", "2022 – 2023", "A colour contrast checker.", "Grid", "2021 – 2022", "A layout tool.", "", "https://only.example.com"]);

    expect(projects.map((project) => [project.name.value, project.description?.value])).toEqual([
      ["Tile", "A colour contrast checker."],
      ["Grid", "A layout tool."],
    ]);
  });
});
