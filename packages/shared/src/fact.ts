import { z } from "zod";

import { IdSchema, TextSchema } from "./primitives.js";

// What a Curation records by code when it completes, with no Model call: the counted things a
// Requirement such as "5 years of experience" is answered by, which never become Statements.
export const FactKindSchema = z.enum(["years_of_experience", "education", "certification", "language", "skill"]);
export type FactKind = z.infer<typeof FactKindSchema>;

const FactFieldsSchema = z.object({
  id: IdSchema,
  kind: FactKindSchema,
  text: TextSchema,
  sourceId: IdSchema.nullable(),
});

const factHasSource = (kind: FactKind): boolean => kind !== "years_of_experience";

// The source is the Education, Certification, Language, or Skill of the confirmed Profile the Fact
// restates. Years of experience are counted across every Experience, so they have none.
export const FactSchema = FactFieldsSchema.refine((fact) => factHasSource(fact.kind) === (fact.sourceId !== null), {
  message: "Every Fact but the years of experience names the Profile part it restates",
  path: ["sourceId"],
});

export type Fact = z.infer<typeof FactSchema>;
