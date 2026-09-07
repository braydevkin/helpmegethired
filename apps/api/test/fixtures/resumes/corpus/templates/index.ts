import type { Layout, Person } from "../people.ts";
import { canvaLike } from "./canva-like.ts";
import { latexLike } from "./latex-like.ts";
import { linkedinExport } from "./linkedin-export.ts";
import { singleColumn } from "./single-column.ts";
import { twoColumns } from "./two-columns.ts";

const templates: Record<Layout, (person: Person) => string> = {
  "single-column": singleColumn,
  "two-columns": twoColumns,
  "canva-like": canvaLike,
  "latex-like": latexLike,
  "linkedin-export": linkedinExport,
};

export const render = (person: Person): string => templates[person.layout](person);
