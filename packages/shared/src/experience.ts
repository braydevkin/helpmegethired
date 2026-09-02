import { z } from "zod";

import { CalendarDateSchema, IdSchema, SkillListSchema, TextSchema } from "./primitives.js";

const OPEN_PERIOD = null;

function endsAfterItStarts({ startDate, endDate }: { startDate: string; endDate: string | null }) {
  return endDate === OPEN_PERIOD || endDate >= startDate;
}

export const ExperienceSchema = z
  .object({
    id: IdSchema,
    company: TextSchema,
    role: TextSchema,
    startDate: CalendarDateSchema,
    endDate: CalendarDateSchema.nullable(),
    description: TextSchema.optional(),
    skills: SkillListSchema,
  })
  .refine(endsAfterItStarts, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export type Experience = z.infer<typeof ExperienceSchema>;
