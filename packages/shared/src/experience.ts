import { z } from "zod";

import { IdSchema, SkillListSchema, TextSchema } from "./primitives.js";
import { PeriodSchema } from "./profile-draft.js";

// A heading with no separator names a role and nothing else, so the company can be missing.
export const ExperienceSchema = z.object({
  id: IdSchema,
  company: TextSchema.nullable(),
  role: TextSchema,
  period: PeriodSchema.nullable(),
  description: TextSchema.nullable(),
  skills: SkillListSchema,
});

export type Experience = z.infer<typeof ExperienceSchema>;
