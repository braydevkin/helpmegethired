import { z } from "zod";
export declare const ProfileSchema: z.ZodObject<{
    id: z.ZodUUID;
    accountId: z.ZodUUID;
    basicProfile: z.ZodObject<{
        fullName: z.ZodString;
        headline: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
        linkedinUrl: z.ZodOptional<z.ZodURL>;
    }, z.core.$strip>;
    experiences: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        company: z.ZodString;
        role: z.ZodString;
        startDate: z.ZodISODate;
        endDate: z.ZodNullable<z.ZodISODate>;
        description: z.ZodOptional<z.ZodString>;
        skills: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    projects: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        name: z.ZodString;
        description: z.ZodString;
        url: z.ZodOptional<z.ZodURL>;
        skills: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
export type Profile = z.infer<typeof ProfileSchema>;
//# sourceMappingURL=profile.d.ts.map