import { z } from "zod";
export declare const ExperienceSchema: z.ZodObject<{
    id: z.ZodUUID;
    company: z.ZodString;
    role: z.ZodString;
    startDate: z.ZodISODate;
    endDate: z.ZodNullable<z.ZodISODate>;
    description: z.ZodOptional<z.ZodString>;
    skills: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type Experience = z.infer<typeof ExperienceSchema>;
//# sourceMappingURL=experience.d.ts.map