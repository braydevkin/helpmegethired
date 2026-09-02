import { z } from "zod";
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodUUID;
    name: z.ZodString;
    description: z.ZodString;
    url: z.ZodOptional<z.ZodURL>;
    skills: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type Project = z.infer<typeof ProjectSchema>;
//# sourceMappingURL=project.d.ts.map