import { z } from "zod";
import { IdSchema, SkillListSchema, TextSchema } from "./primitives.js";
export const ProjectSchema = z.object({
    id: IdSchema,
    name: TextSchema,
    description: TextSchema,
    url: z.url().optional(),
    skills: SkillListSchema,
});
//# sourceMappingURL=project.js.map