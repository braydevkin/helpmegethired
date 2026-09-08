import { z } from "zod";

import { IdSchema, SkillListSchema, TextSchema } from "./primitives.js";

export const ProjectSchema = z.object({
  id: IdSchema,
  name: TextSchema,
  description: TextSchema.nullable(),
  url: z.url().nullable(),
  skills: SkillListSchema,
});

export type Project = z.infer<typeof ProjectSchema>;
