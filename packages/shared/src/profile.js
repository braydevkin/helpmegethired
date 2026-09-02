import { z } from "zod";
import { BasicProfileSchema } from "./basic-profile.js";
import { ExperienceSchema } from "./experience.js";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { ProjectSchema } from "./project.js";
export const ProfileSchema = z.object({
    id: IdSchema,
    accountId: IdSchema,
    basicProfile: BasicProfileSchema,
    experiences: z.array(ExperienceSchema),
    projects: z.array(ProjectSchema),
    updatedAt: TimestampSchema,
});
//# sourceMappingURL=profile.js.map